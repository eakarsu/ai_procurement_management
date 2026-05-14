"""
In-process rate limiting using sliding window counters stored in a dict.
Falls back gracefully (no crash) if Redis is unavailable.
Two limiters:
  - ai_limiter: 20 requests per hour per user
  - general_limiter: 100 requests per 15 minutes per IP
"""
import time
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import HTTPException, Request


class SlidingWindowLimiter:
    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._windows: Dict[str, Deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        """Raises HTTP 429 if limit exceeded."""
        now = time.time()
        cutoff = now - self.window_seconds
        window = self._windows[key]

        # evict old timestamps
        while window and window[0] < cutoff:
            window.popleft()

        if len(window) >= self.max_requests:
            retry_after = int(window[0] + self.window_seconds - now) + 1
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "Rate limit exceeded",
                    "retry_after_seconds": retry_after,
                    "limit": self.max_requests,
                    "window_seconds": self.window_seconds,
                },
                headers={"Retry-After": str(retry_after)},
            )
        window.append(now)


# Singleton limiters
ai_limiter = SlidingWindowLimiter(max_requests=20, window_seconds=3600)      # 20/hour
general_limiter = SlidingWindowLimiter(max_requests=100, window_seconds=900)  # 100/15min


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
