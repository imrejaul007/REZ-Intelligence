import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  salonExpert,
  SalonContext,
  Client,
  ServiceCategory,
  Appointment
} from '../services/salonExpert';
import { logger } from '../services/salonExpert';
import {
  ALL_SERVICES,
  HAIR_SERVICES,
  NAIL_SERVICES,
  SKINCARE_SERVICES,
  BODY_SERVICES,
  MAKEUP_SERVICES,
  BROW_LASH_SERVICES,
  SKIN_TYPES
} from '../config/knowledge';

const router = Router();

const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message
            }))
          }
        });
      }
      next(error);
    }
  };
};

const chatSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().min(1).max(5000),
  context: z.object({
    clientId: z.string().optional(),
    client: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().email(),
      phone: z.string().optional(),
      skinType: z.string().optional(),
      allergies: z.array(z.string()).optional(),
      preferences: z.array(z.string()).optional(),
      tier: z.enum(['basic', 'premium', 'vip']).optional()
    }).nullable().optional(),
    serviceId: z.string().optional(),
    category: z.string().optional(),
    budget: z.number().optional(),
    preferredDate: z.string().datetime().optional(),
    appointments: z.array(z.object({
      id: z.string(),
      serviceId: z.string(),
      dateTime: z.string().datetime(),
      stylistId: z.string(),
      status: z.string()
    })).optional(),
    conversationHistory: z.array(z.string()).optional()
  }).optional()
});

const createAppointmentSchema = z.object({
  serviceId: z.string(),
  clientId: z.string(),
  clientName: z.string(),
  dateTime: z.string().datetime(),
  stylistId: z.string().optional(),
  notes: z.string().optional()
});

const updateAppointmentSchema = z.object({
  dateTime: z.string().datetime().optional(),
  stylistId: z.string().optional(),
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled', 'no_show']).optional(),
  notes: z.string().optional()
});

router.post('/chat', validateRequest(chatSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId: providedSessionId, message, context } = req.body;
    const sessionId = providedSessionId || uuidv4();

    logger.info('Salon chat request received', { sessionId, messageLength: message.length });

    const appointments: Appointment[] = [];
    if (context?.appointments) {
      for (const appt of context.appointments) {
        const existing = salonExpert.getAppointment(appt.id);
        if (existing) {
          appointments.push(existing);
        }
      }
    }

    const salonContext: SalonContext = {
      client: context?.client || null,
      sessionId,
      conversationHistory: context?.conversationHistory || [],
      currentService: null,
      currentCategory: context?.category ? context.category as ServiceCategory : null,
      appointments,
      budget: context?.budget || null
    };

    const response = await salonExpert.processSalonQuery(salonContext, message);

    res.json({
      success: true,
      data: {
        response: response.message,
        actions: response.actions,
        data: response.data
      },
      meta: {
        sessionId,
        processingTimeMs: response.processingTime,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Salon chat endpoint error', { error });
    next(error);
  }
});

router.get('/services', async (req: Request, res: Response) => {
  const category = req.query.category as ServiceCategory;

  let services;
  switch (category) {
    case ServiceCategory.HAIR:
      services = HAIR_SERVICES;
      break;
    case ServiceCategory.NAILS:
      services = NAIL_SERVICES;
      break;
    case ServiceCategory.SKINCARE:
      services = SKINCARE_SERVICES;
      break;
    case ServiceCategory.BODY:
      services = BODY_SERVICES;
      break;
    case ServiceCategory.MAKEUP:
      services = MAKEUP_SERVICES;
      break;
    case ServiceCategory.BROW_LASH:
      services = BROW_LASH_SERVICES;
      break;
    default:
      services = ALL_SERVICES;
  }

  res.json({
    success: true,
    data: {
      services,
      count: services.length
    }
  });
});

router.get('/services/:serviceId', async (req: Request, res: Response) => {
  const { serviceId } = req.params;

  const service = ALL_SERVICES.find(s => s.id === serviceId);

  if (!service) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Service ${serviceId} not found`
      }
    });
  }

  res.json({
    success: true,
    data: { service }
  });
});

router.get('/services/category/:category', async (req: Request, res: Response) => {
  const { category } = req.params;
  const categoryEnum = category as ServiceCategory;

  let services;
  switch (categoryEnum) {
    case ServiceCategory.HAIR:
      services = HAIR_SERVICES;
      break;
    case ServiceCategory.NAILS:
      services = NAIL_SERVICES;
      break;
    case ServiceCategory.SKINCARE:
      services = SKINCARE_SERVICES;
      break;
    case ServiceCategory.BODY:
      services = BODY_SERVICES;
      break;
    case ServiceCategory.MAKEUP:
      services = MAKEUP_SERVICES;
      break;
    case ServiceCategory.BROW_LASH:
      services = BROW_LASH_SERVICES;
      break;
    default:
      services = ALL_SERVICES;
  }

  res.json({
    success: true,
    data: {
      category,
      services,
      count: services.length
    }
  });
});

router.post('/appointments', validateRequest(createAppointmentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serviceId, clientId, clientName, dateTime, stylistId, notes } = req.body;

    logger.info('Creating appointment', { serviceId, clientId, dateTime });

    const appointment = await salonExpert.createAppointment(
      serviceId,
      clientId,
      clientName,
      new Date(dateTime),
      stylistId || ''
    );

    if (!appointment) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Failed to create appointment. Please verify service and stylist IDs.'
        }
      });
    }

    if (notes) {
      appointment.notes = notes;
    }

    res.status(201).json({
      success: true,
      data: { appointment }
    });

  } catch (error) {
    logger.error('Appointment creation error', { error });
    next(error);
  }
});

router.get('/appointments', async (req: Request, res: Response) => {
  const clientId = req.query.clientId as string;

  if (!clientId) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'clientId query parameter is required'
      }
    });
  }

  const appointments = salonExpert.getAppointmentsByClient(clientId);

  res.json({
    success: true,
    data: {
      appointments,
      count: appointments.length
    }
  });
});

router.get('/appointments/:appointmentId', async (req: Request, res: Response) => {
  const { appointmentId } = req.params;

  const appointment = salonExpert.getAppointment(appointmentId);

  if (!appointment) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Appointment ${appointmentId} not found`
      }
    });
  }

  res.json({
    success: true,
    data: { appointment }
  });
});

router.patch('/appointments/:appointmentId', validateRequest(updateAppointmentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { appointmentId } = req.params;
    const updates = req.body;

    let appointment = salonExpert.getAppointment(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Appointment ${appointmentId} not found`
        }
      });
    }

    if (updates.dateTime) appointment.dateTime = new Date(updates.dateTime);
    if (updates.stylistId) appointment.stylistId = updates.stylistId;
    if (updates.status) appointment.status = updates.status as Appointment['status'];
    if (updates.notes !== undefined) appointment.notes = updates.notes;
    appointment.updatedAt = new Date();

    res.json({
      success: true,
      data: { appointment }
    });

  } catch (error) {
    next(error);
  }
});

router.delete('/appointments/:appointmentId', async (req: Request, res: Response) => {
  const { appointmentId } = req.params;

  let appointment = salonExpert.getAppointment(appointmentId);

  if (!appointment) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Appointment ${appointmentId} not found`
      }
    });
  }

  appointment.status = 'cancelled';
  appointment.updatedAt = new Date();

  res.json({
    success: true,
    data: { appointment }
  });
});

router.get('/stylists', async (req: Request, res: Response) => {
  const category = req.query.category as ServiceCategory;

  const stylists = salonExpert.getStylists(category);

  res.json({
    success: true,
    data: {
      stylists,
      count: stylists.length
    }
  });
});

router.get('/stylists/:stylistId', async (req: Request, res: Response) => {
  const { stylistId } = req.params;

  const stylists = salonExpert.getStylists();
  const stylist = stylists.find(s => s.id === stylistId);

  if (!stylist) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Stylist ${stylistId} not found`
      }
    });
  }

  res.json({
    success: true,
    data: { stylist }
  });
});

router.get('/availability', async (req: Request, res: Response) => {
  const serviceId = req.query.serviceId as string;
  const stylistId = req.query.stylistId as string;

  const service = ALL_SERVICES.find(s => s.id === serviceId);
  const duration = service?.duration || 60;

  const slots = [];
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const times = ['9:00 AM', '10:30 AM', '1:00 PM', '2:30 PM', '4:00 PM'];

  const today = new Date();
  for (let i = 1; i <= 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);

    if (date.getDay() !== 0) {
      const dayName = days[date.getDay() - 1] || 'Saturday';
      slots.push({
        day: dayName,
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        times: times.slice(0, 3)
      });
    }
  }

  res.json({
    success: true,
    data: {
      service: service || null,
      stylist: stylistId || null,
      slots: slots.slice(0, 5),
      duration
    }
  });
});

router.get('/skin-types', async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      skinTypes: SKIN_TYPES
    }
  });
});

router.get('/categories', async (req: Request, res: Response) => {
  const categories = [
    { id: ServiceCategory.HAIR, name: 'Hair Services', icon: 'scissors', serviceCount: HAIR_SERVICES.length },
    { id: ServiceCategory.NAILS, name: 'Nail Services', icon: 'nail polish', serviceCount: NAIL_SERVICES.length },
    { id: ServiceCategory.SKINCARE, name: 'Skin Care', icon: 'sparkles', serviceCount: SKINCARE_SERVICES.length },
    { id: ServiceCategory.BODY, name: 'Body & Spa', icon: 'spa', serviceCount: BODY_SERVICES.length },
    { id: ServiceCategory.MAKEUP, name: 'Makeup', icon: 'lipstick', serviceCount: MAKEUP_SERVICES.length },
    { id: ServiceCategory.BROW_LASH, name: 'Brow & Lash', icon: 'eye', serviceCount: BROW_LASH_SERVICES.length }
  ];

  res.json({
    success: true,
    data: { categories }
  });
});

router.post('/recommend', async (req: Request, res: Response) => {
  const { category, skinType, concern, budget } = req.body;

  let services = ALL_SERVICES;

  if (category) {
    services = services.filter(s => s.category === category);
  }

  if (budget) {
    services = services.filter(s => s.price <= budget * 1.2);
  }

  if (concern) {
    services = services.filter(s =>
      s.description.toLowerCase().includes(concern.toLowerCase()) ||
      s.benefits.some(b => b.toLowerCase().includes(concern.toLowerCase()))
    );
  }

  if (skinType) {
    services = services.filter(s =>
      s.suitableFor.some(su => su.toLowerCase().includes(skinType.toLowerCase()) || su === 'All skin types')
    );
  }

  services = services.slice(0, 5);

  res.json({
    success: true,
    data: {
      services,
      count: services.length,
      filters: { category, skinType, concern, budget }
    }
  });
});

export { router as salonRouter };
