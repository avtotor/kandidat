import { z } from 'zod';
import { insertSessionSchema, sessions, answers } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  sessions: {
    create: {
      method: 'POST' as const,
      path: '/api/sessions' as const,
      input: z.object({
        role: z.enum(['cpp', 'stm32', 'data', 'ai']),
        skills: z.object({
          postgres: z.number().min(0).max(10),
          cpp: z.number().min(0).max(10),
          api: z.number().min(0).max(10),
          linux: z.number().min(0).max(10),
          llm: z.number().min(0).max(10),
          git: z.number().min(0).max(10),
        }).optional(),
      }),
      responses: {
        201: z.object({
          id: z.number(),
          role: z.string(),
          status: z.string(),
          createdAt: z.any(),
          questions: z.array(z.object({
            id: z.number(),
            text: z.string(),
            options: z.array(z.string()),
            image: z.string().optional(),
            code: z.string().optional(),
          }))
        }),
        400: errorSchemas.validation,
      },
    },
    updateStatus: {
      method: 'PATCH' as const,
      path: '/api/sessions/:id' as const,
      input: z.object({
        status: z.enum(['completed']),
      }),
      responses: {
        200: z.custom<typeof sessions.$inferSelect>(),
        404: errorSchemas.notFound,
      }
    },
    updateCandidate: {
      method: 'PATCH' as const,
      path: '/api/sessions/:id/candidate' as const,
      input: z.object({
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        phone: z.string().min(5).max(50),
      }),
      responses: {
        200: z.custom<typeof sessions.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    uploadResume: {
      method: 'POST' as const,
      path: '/api/sessions/:id/resume' as const,
      input: z.object({
        file: z.string(), // base64
        fileName: z.string().min(1).max(255),
      }),
      responses: {
        200: z.custom<typeof sessions.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/sessions/:id' as const,
      input: z.void(),
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  answers: {
    submit: {
      method: 'POST' as const,
      path: '/api/sessions/:id/answers' as const,
      input: z.object({
        questionId: z.number(),
        selectedIndex: z.number(),
        timeSpentSec: z.number().int().min(0).optional(),
      }),
      responses: {
        201: z.object({
          isCorrect: z.boolean(),
          correctIndex: z.number(),
          answer: z.custom<typeof answers.$inferSelect>(),
        }),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
  },
  questions: {
    counts: {
      method: 'GET' as const,
      path: '/api/questions/counts' as const,
      responses: {
        200: z.object({
          cpp: z.number(),
          stm32: z.number(),
          data: z.number(),
          ai: z.number(),
        }),
      },
    },
  },
  dashboard: {
    list: {
      method: 'GET' as const,
      path: '/api/dashboard' as const,
      responses: {
        200: z.array(
          z.object({
            id: z.number(),
            role: z.string(),
            status: z.string(),
            createdAt: z.any(),
            firstName: z.string().nullable().optional(),
            lastName: z.string().nullable().optional(),
            phone: z.string().nullable().optional(),
            resumePath: z.string().nullable().optional(),
            skills: z.object({
              postgres: z.number().min(0).max(10),
              cpp: z.number().min(0).max(10),
              api: z.number().min(0).max(10),
              linux: z.number().min(0).max(10),
              llm: z.number().min(0).max(10),
              git: z.number().min(0).max(10),
            }).nullable().optional(),
            answers: z.array(z.custom<typeof answers.$inferSelect>()),
          })
        ),
      },
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
