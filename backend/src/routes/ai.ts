import express from 'express';
import { AIService } from '../services/aiService';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = express.Router();

router.post('/runtime-brief', async (req: AuthRequest, res) => {
  try {
    const prompt = String(req.body?.prompt || '').trim();
    if (!prompt) return res.status(400).json({ success: false, error: 'Prompt is required' });
    if (!req.user) return res.status(401).json({ success: false, error: 'Authentication required' });
    const apiKey = process.env.OPENROUTER_API_KEY;
    const baseUrl = process.env.OPENROUTER_BASE_URL;
    const model = process.env.OPENROUTER_MODEL;
    if (!apiKey || !baseUrl || !model) throw new Error('OpenRouter runtime is not configured');
    const providerResponse = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a procurement operations reviewer. Return concise risks, evidence gaps, next actions, uncertainty, and required human review.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
      }),
    });
    if (!providerResponse.ok) throw new Error(`OpenRouter returned ${providerResponse.status}`);
    const payload: any = await providerResponse.json();
    const output = String(payload?.choices?.[0]?.message?.content || '').trim();
    if (!output) throw new Error('OpenRouter returned an empty response');
    const saved = await prisma.aiResult.create({
      data: { tenantId: req.user.tenantId, userId: req.user.id, feature: 'runtime-brief', input: { prompt }, output, model },
    });
    return res.json({ success: true, id: saved.id, response: output, model, provider: 'openrouter' });
  } catch (error) {
    console.error('Error generating runtime procurement brief:', error);
    return res.status(502).json({ success: false, error: 'OpenRouter request failed' });
  }
});

// Generate AI insights for procurement data
router.post('/insights', async (req, res) => {
  try {
    const { type, data } = req.body;

    if (!type || !data) {
      return res.status(400).json({
        success: false,
        error: 'Type and data are required'
      });
    }

    let insights;

    switch (type) {
      case 'vendor-analysis':
        insights = await AIService.generateVendorScore(data);
        break;
      case 'bid-analysis':
        insights = await AIService.analyzeBidProposal(data);
        break;
      case 'compliance-check':
        insights = await AIService.checkCompliance(data.document, data.regulations || []);
        break;
      case 'document-analysis':
        insights = await AIService.analyzeDocument(data.text, data.analysisType);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid analysis type'
        });
    }

    return res.json({
      success: true,
      data: {
        type,
        insights,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error generating AI insights:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate AI insights'
    });
  }
});

// Generate comprehensive procurement recommendations
router.post('/recommendations', async (req, res) => {
  try {
    const { procurementData } = req.body;

    if (!procurementData) {
      return res.status(400).json({
        success: false,
        error: 'Procurement data is required'
      });
    }

    const recommendations = await generateProcurementRecommendations(procurementData);

    return res.json({
      success: true,
      data: {
        recommendations,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate recommendations'
    });
  }
});

// Generate risk assessment insights
router.post('/risk-assessment', async (req, res) => {
  try {
    const { entityType, entityData } = req.body;

    if (!entityType || !entityData) {
      return res.status(400).json({
        success: false,
        error: 'Entity type and data are required'
      });
    }

    const riskAssessment = await generateRiskAssessment(entityType, entityData);

    return res.json({
      success: true,
      data: {
        riskAssessment,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error generating risk assessment:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate risk assessment'
    });
  }
});

// Generate market analysis insights
router.post('/market-analysis', async (req, res) => {
  try {
    const { category, requirements } = req.body;

    if (!category) {
      return res.status(400).json({
        success: false,
        error: 'Category is required'
      });
    }

    const marketAnalysis = await generateMarketAnalysis(category, requirements);

    return res.json({
      success: true,
      data: {
        marketAnalysis,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error generating market analysis:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate market analysis'
    });
  }
});

// Helper functions
async function generateProcurementRecommendations(procurementData: any): Promise<any> {
  const prompt = `Based on this procurement data, provide strategic recommendations:
  
  Data: ${JSON.stringify(procurementData)}
  
  Analyze and provide recommendations for:
  1. Vendor selection optimization
  2. Cost reduction opportunities
  3. Risk mitigation strategies
  4. Process improvements
  5. Compliance enhancements
  6. Timeline optimizations
  
  Return as JSON with structured recommendations.`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        {
          role: 'system',
          content: 'You are a procurement strategy expert. Provide actionable, data-driven recommendations in JSON format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.3
    })
  });

  const result: any = await response.json();
  return JSON.parse(result.choices[0]?.message?.content || '{}');
}

async function generateRiskAssessment(entityType: string, entityData: any): Promise<any> {
  const prompt = `Conduct a comprehensive risk assessment for this ${entityType}:
  
  Data: ${JSON.stringify(entityData)}
  
  Assess risks in the following areas:
  1. Financial risk
  2. Operational risk
  3. Compliance risk
  4. Reputational risk
  5. Supply chain risk
  6. Cybersecurity risk
  
  For each risk category, provide:
  - Risk level (low/medium/high)
  - Risk score (1-10)
  - Key risk factors
  - Mitigation strategies
  
  Return as JSON with structured risk assessment.`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        {
          role: 'system',
          content: 'You are a risk assessment expert specializing in procurement and vendor management. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.2
    })
  });

  const result: any = await response.json();
  return JSON.parse(result.choices[0]?.message?.content || '{}');
}

async function generateMarketAnalysis(category: string, requirements: any): Promise<any> {
  const prompt = `Provide market analysis for procurement category: ${category}
  
  Requirements: ${JSON.stringify(requirements)}
  
  Analyze:
  1. Market trends and outlook
  2. Competitive landscape
  3. Pricing benchmarks
  4. Supplier availability
  5. Technology trends
  6. Regulatory considerations
  7. Opportunities and threats
  
  Provide actionable insights for procurement strategy.
  Return as JSON with structured market analysis.`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        {
          role: 'system',
          content: 'You are a market research expert with deep knowledge of procurement markets and supply chain dynamics. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.4
    })
  });

  const result: any = await response.json();
  return JSON.parse(result.choices[0]?.message?.content || '{}');
}

// Calculate AI-driven procurement statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await calculateAIStats();

    return res.json({
      success: true,
      data: {
        stats,
        calculatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error calculating AI stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to calculate AI statistics'
    });
  }
});

// Calculate AI performance metrics
router.get('/performance', async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const performance = await calculateAIPerformance(period as string);

    return res.json({
      success: true,
      data: {
        performance,
        period,
        calculatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error calculating AI performance:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to calculate AI performance metrics'
    });
  }
});

// Calculate vendor scoring statistics
router.get('/vendor-scores', async (req, res) => {
  try {
    const vendorScores = await calculateVendorScoreStats();

    return res.json({
      success: true,
      data: {
        vendorScores,
        calculatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error calculating vendor scores:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to calculate vendor score statistics'
    });
  }
});

// Calculate bid analysis statistics
router.get('/bid-analysis', async (req, res) => {
  try {
    const bidAnalysis = await calculateBidAnalysisStats();

    return res.json({
      success: true,
      data: {
        bidAnalysis,
        calculatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error calculating bid analysis stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to calculate bid analysis statistics'
    });
  }
});

// Helper functions for AI statistics
async function calculateAIStats(): Promise<any> {
  // Mock data - in real implementation, this would query database
  const mockStats = {
    totalAnalyses: 156,
    vendorAnalyses: 45,
    bidAnalyses: 67,
    complianceChecks: 44,
    averageAnalysisTime: 2.3, // seconds
    accuracyRate: 94.7, // percentage
    costSavings: 125000, // dollars
    riskMitigation: {
      highRiskVendors: 3,
      mediumRiskVendors: 12,
      lowRiskVendors: 30
    },
    complianceImprovement: 18.5, // percentage
    trendsAnalysis: {
      monthlyGrowth: 12.3,
      userAdoption: 87.2,
      processingEfficiency: 23.8
    }
  };

  return mockStats;
}

async function calculateAIPerformance(period: string): Promise<any> {
  // Mock performance data based on period
  const mockPerformance = {
    analysisAccuracy: {
      vendor: 96.2,
      bid: 94.8,
      compliance: 92.5
    },
    responseTime: {
      average: 2.1,
      p95: 4.2,
      p99: 8.5
    },
    throughput: {
      analysesPerHour: 45,
      peakLoad: 67,
      utilizationRate: 73.2
    },
    qualityMetrics: {
      userSatisfaction: 4.3, // out of 5
      recommendationAccuracy: 89.4,
      falsePositiveRate: 2.8
    },
    costEfficiency: {
      costPerAnalysis: 0.23,
      timeToInsight: 1.8, // minutes
      automationRate: 78.5
    }
  };

  return mockPerformance;
}

async function calculateVendorScoreStats(): Promise<any> {
  // Mock vendor scoring statistics
  const mockVendorStats = {
    totalVendorsScored: 45,
    averageScore: 73.2,
    scoreDistribution: {
      '90-100': 5,
      '80-89': 12,
      '70-79': 18,
      '60-69': 8,
      'below-60': 2
    },
    categoryBreakdown: {
      financial: { average: 76.8, median: 78.2 },
      technical: { average: 72.4, median: 74.1 },
      compliance: { average: 81.3, median: 82.7 },
      experience: { average: 68.9, median: 70.2 }
    },
    riskDistribution: {
      low: 25,
      medium: 17,
      high: 3
    },
    improvementRecommendations: {
      total: 127,
      implemented: 89,
      pending: 38
    }
  };

  return mockVendorStats;
}

async function calculateBidAnalysisStats(): Promise<any> {
  // Mock bid analysis statistics
  const mockBidStats = {
    totalBidsAnalyzed: 67,
    averageScores: {
      technical: 74.5,
      cost: 78.2,
      timeline: 71.8,
      risk: 76.3,
      overall: 75.2
    },
    winningBidCharacteristics: {
      averageTechnicalScore: 88.3,
      averageCostScore: 82.1,
      averageTimelineScore: 79.5,
      averageRiskScore: 85.7
    },
    analysisAccuracy: {
      correctPredictions: 89.6,
      falsePositives: 4.2,
      falseNegatives: 6.2
    },
    timeToCompletion: {
      average: 3.4, // minutes
      fastest: 1.2,
      slowest: 8.7
    },
    insightsGenerated: {
      strengths: 201,
      weaknesses: 167,
      recommendations: 289
    }
  };

  return mockBidStats;
}

// Trigger AI analysis for entities
router.post('/trigger-analysis', async (req, res) => {
  try {
    const { entityType, entityId, analysisTypes } = req.body;

    if (!entityType || !entityId || !analysisTypes || !Array.isArray(analysisTypes)) {
      return res.status(400).json({
        success: false,
        error: 'Entity type, entity ID, and analysis types are required'
      });
    }

    const analysisJob = await triggerAnalysisJob(entityType, entityId, analysisTypes);

    return res.json({
      success: true,
      data: {
        jobId: analysisJob.id,
        status: analysisJob.status,
        estimatedCompletion: analysisJob.estimatedCompletion,
        triggeredAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error triggering AI analysis:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to trigger AI analysis'
    });
  }
});

// Get analysis job status
router.get('/analysis-status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const jobStatus = await getAnalysisJobStatus(jobId);

    return res.json({
      success: true,
      data: jobStatus
    });
  } catch (error) {
    console.error('Error getting analysis job status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get analysis job status'
    });
  }
});

// Bulk trigger analysis for multiple entities
router.post('/bulk-trigger', async (req, res) => {
  try {
    const { entities, analysisTypes } = req.body;

    if (!entities || !Array.isArray(entities) || !analysisTypes || !Array.isArray(analysisTypes)) {
      return res.status(400).json({
        success: false,
        error: 'Entities and analysis types are required'
      });
    }

    const bulkJob = await triggerBulkAnalysis(entities, analysisTypes);

    return res.json({
      success: true,
      data: {
        bulkJobId: bulkJob.id,
        totalEntities: entities.length,
        status: bulkJob.status,
        estimatedCompletion: bulkJob.estimatedCompletion,
        triggeredAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error triggering bulk AI analysis:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to trigger bulk AI analysis'
    });
  }
});

// Schedule recurring analysis
router.post('/schedule-analysis', async (req, res) => {
  try {
    const { entityType, schedule, analysisTypes } = req.body;

    if (!entityType || !schedule || !analysisTypes) {
      return res.status(400).json({
        success: false,
        error: 'Entity type, schedule, and analysis types are required'
      });
    }

    const scheduledJob = await scheduleRecurringAnalysis(entityType, schedule, analysisTypes);

    return res.json({
      success: true,
      data: {
        scheduleId: scheduledJob.id,
        nextRun: scheduledJob.nextRun,
        status: scheduledJob.status,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error scheduling AI analysis:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to schedule AI analysis'
    });
  }
});

// Helper functions for analysis triggers
async function triggerAnalysisJob(entityType: string, entityId: string, analysisTypes: string[]): Promise<any> {
  // Mock job creation - in real implementation, this would queue a job
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const estimatedDuration = analysisTypes.length * 30; // 30 seconds per analysis type
  
  const job = {
    id: jobId,
    entityType,
    entityId,
    analysisTypes,
    status: 'queued',
    estimatedCompletion: new Date(Date.now() + estimatedDuration * 1000).toISOString(),
    createdAt: new Date().toISOString()
  };

  // Simulate async processing
  setTimeout(async () => {
    await processAnalysisJob(job);
  }, 1000);

  return job;
}

async function processAnalysisJob(job: any): Promise<void> {
  // Mock job processing
  job.status = 'processing';
  job.startedAt = new Date().toISOString();

  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 5000));

  job.status = 'completed';
  job.completedAt = new Date().toISOString();
  job.results = {
    analysisCount: job.analysisTypes.length,
    insights: `Analysis completed for ${job.entityType} ${job.entityId}`,
    recommendations: ['Recommendation 1', 'Recommendation 2']
  };
}

async function getAnalysisJobStatus(jobId: string): Promise<any> {
  // Mock job status retrieval
  const mockStatus = {
    jobId,
    status: 'completed',
    progress: 100,
    createdAt: new Date(Date.now() - 300000).toISOString(),
    startedAt: new Date(Date.now() - 240000).toISOString(),
    completedAt: new Date(Date.now() - 60000).toISOString(),
    results: {
      analysisCount: 3,
      insights: 'Comprehensive analysis completed successfully',
      recommendations: [
        'Improve vendor qualification process',
        'Implement risk mitigation strategies',
        'Optimize bid evaluation criteria'
      ]
    }
  };

  return mockStatus;
}

async function triggerBulkAnalysis(entities: any[], analysisTypes: string[]): Promise<any> {
  // Mock bulk job creation
  const bulkJobId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const estimatedDuration = entities.length * analysisTypes.length * 30; // 30 seconds per analysis
  
  const bulkJob = {
    id: bulkJobId,
    entities,
    analysisTypes,
    status: 'queued',
    totalEntities: entities.length,
    processedEntities: 0,
    estimatedCompletion: new Date(Date.now() + estimatedDuration * 1000).toISOString(),
    createdAt: new Date().toISOString()
  };

  // Simulate async bulk processing
  setTimeout(async () => {
    await processBulkAnalysis(bulkJob);
  }, 2000);

  return bulkJob;
}

async function processBulkAnalysis(bulkJob: any): Promise<void> {
  // Mock bulk processing
  bulkJob.status = 'processing';
  bulkJob.startedAt = new Date().toISOString();

  // Simulate processing each entity
  for (let i = 0; i < bulkJob.entities.length; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    bulkJob.processedEntities = i + 1;
  }

  bulkJob.status = 'completed';
  bulkJob.completedAt = new Date().toISOString();
  bulkJob.results = {
    totalProcessed: bulkJob.entities.length,
    successfulAnalyses: bulkJob.entities.length - 1,
    failedAnalyses: 1,
    aggregatedInsights: 'Bulk analysis completed successfully'
  };
}

async function scheduleRecurringAnalysis(entityType: string, schedule: string, analysisTypes: string[]): Promise<any> {
  // Mock scheduled job creation
  const scheduleId = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const scheduledJob = {
    id: scheduleId,
    entityType,
    schedule,
    analysisTypes,
    status: 'active',
    nextRun: calculateNextRun(schedule),
    createdAt: new Date().toISOString()
  };

  return scheduledJob;
}

function calculateNextRun(schedule: string): string {
  // Mock next run calculation
  const scheduleMap: { [key: string]: number } = {
    'daily': 24 * 60 * 60 * 1000,
    'weekly': 7 * 24 * 60 * 60 * 1000,
    'monthly': 30 * 24 * 60 * 60 * 1000
  };

  const delay = scheduleMap[schedule] || scheduleMap['daily'] || 24 * 60 * 60 * 1000;
  return new Date(Date.now() + delay).toISOString();
}

export default router;
