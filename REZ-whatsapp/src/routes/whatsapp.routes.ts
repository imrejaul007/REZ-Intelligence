import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import twilio from 'twilio';
import {
  SendMessageSchema,
  CreateSessionSchema,
  CartOperationSchema,
  CreateOrderSchema,
  MessageType,
  ApiResponse,
} from '../types/whatsapp';
import { SessionManager } from '../services/sessionManager';
import { CartService } from '../services/cartService';
import { OrderService } from '../services/orderService';
import { ConversationEngine } from '../services/conversationEngine';
import { validateInternalToken, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

export function createWhatsAppRoutes(
  sessionManager: SessionManager,
  cartService: CartService,
  orderService: OrderService,
  conversationEngine: ConversationEngine,
  twilioClient: twilio.Twilio,
  whatsappPhoneNumber: string
): Router {
  const router = Router();

  // ============================================
  // Send Message
  // ============================================
  router.post(
    '/send',
    validateInternalToken,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const validation = SendMessageSchema.safeParse(req.body);
        if (!validation.success) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request body',
              details: validation.error.errors,
            },
          };
          res.status(400).json(response);
          return;
        }

        const { to, type, content, sessionId, metadata } = validation.data;

        // Send message via Twilio
        const message = await twilioClient.messages.create({
          from: `whatsapp:${whatsappPhoneNumber}`,
          to: `whatsapp:${to}`,
          body: content.body,
          mediaUrl: content.mediaUrl ? [content.mediaUrl] : undefined,
          ...(content.interactive && {
            persistentAction: [`fbma://WAButtonTemplate/${to}`],
          }),
        });

        // If session provided, add to conversation history
        if (sessionId) {
          await sessionManager.addMessage(
            sessionId,
            'assistant',
            content.body || 'Media message sent',
            message.sid
          );
        }

        logger.info('WhatsApp message sent', {
          to,
          type,
          sid: message.sid,
        });

        const response: ApiResponse<{ sid: string; status: string }> = {
          success: true,
          data: {
            sid: message.sid,
            status: message.status,
          },
        };

        res.status(200).json(response);
      } catch (error) {
        logger.error('Failed to send WhatsApp message', { error });
        next(error);
      }
    }
  );

  // ============================================
  // Session Management
  // ============================================
  router.post(
    '/session',
    validateInternalToken,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const validation = CreateSessionSchema.safeParse(req.body);
        if (!validation.success) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request body',
              details: validation.error.errors,
            },
          };
          res.status(400).json(response);
          return;
        }

        const { userId, merchantId, phoneNumber, source, metadata } = validation.data;

        // Check for existing session
        let session = await sessionManager.getSessionByUser(userId, merchantId);

        if (session) {
          // Extend existing session
          session = await sessionManager.extendSession(session.sessionId);
        } else {
          // Create new session
          session = await sessionManager.createSession({
            userId,
            merchantId,
            phoneNumber,
            source,
            metadata,
          });

          // Send welcome message
          try {
            await twilioClient.messages.create({
              from: `whatsapp:${whatsappPhoneNumber}`,
              to: `whatsapp:${phoneNumber}`,
              body: 'Welcome! How can I help you today?',
            });
          } catch (msgError) {
            logger.warn('Failed to send welcome message', { error: msgError });
          }
        }

        const response: ApiResponse<{
          sessionId: string;
          state: string;
          expiresAt: Date;
        }> = {
          success: true,
          data: {
            sessionId: session!.sessionId,
            state: session!.state,
            expiresAt: session!.expiresAt,
          },
        };

        res.status(201).json(response);
      } catch (error) {
        logger.error('Failed to create session', { error });
        next(error);
      }
    }
  );

  router.get(
    '/session/:userId',
    validateInternalToken,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { userId } = req.params;
        const merchantId = req.query.merchantId as string;

        const session = await sessionManager.getSessionByUser(userId, merchantId);

        if (!session) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Session not found',
            },
          };
          res.status(404).json(response);
          return;
        }

        const response: ApiResponse<{
          sessionId: string;
          state: string;
          cart: unknown[];
          lastActivity: Date;
          expiresAt: Date;
        }> = {
          success: true,
          data: {
            sessionId: session.sessionId,
            state: session.state,
            cart: session.context.cart,
            lastActivity: session.lastActivity,
            expiresAt: session.expiresAt,
          },
        };

        res.status(200).json(response);
      } catch (error) {
        logger.error('Failed to get session', { error });
        next(error);
      }
    }
  );

  // ============================================
  // Cart Operations
  // ============================================
  router.post(
    '/cart',
    validateInternalToken,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const validation = CartOperationSchema.safeParse(req.body);
        if (!validation.success) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request body',
              details: validation.error.errors,
            },
          };
          res.status(400).json(response);
          return;
        }

        const { sessionId, operation, item, productId, quantity } = validation.data;

        let result;

        switch (operation) {
          case 'add':
            if (!item) {
              result = { success: false, error: 'Item is required for add operation' };
              break;
            }
            result = await cartService.addItem(sessionId, item as any);
            break;

          case 'update':
            if (!productId || quantity === undefined) {
              result = { success: false, error: 'productId and quantity are required for update operation' };
              break;
            }
            result = await cartService.updateItem(sessionId, productId, quantity);
            break;

          case 'remove':
            if (!productId) {
              result = { success: false, error: 'productId is required for remove operation' };
              break;
            }
            result = await cartService.removeItem(sessionId, productId);
            break;

          case 'clear':
            result = await cartService.clearCart(sessionId);
            break;

          default:
            result = { success: false, error: 'Invalid operation' };
        }

        if (!result.success) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'OPERATION_FAILED',
              message: result.error,
            },
          };
          res.status(400).json(response);
          return;
        }

        const response: ApiResponse<{
          cart: unknown;
        }> = {
          success: true,
          data: {
            cart: result.cart,
          },
        };

        res.status(200).json(response);
      } catch (error) {
        logger.error('Cart operation failed', { error });
        next(error);
      }
    }
  );

  router.get(
    '/cart/:sessionId',
    validateInternalToken,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { sessionId } = req.params;

        const result = await cartService.getCart(sessionId);

        if (!result.success) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'OPERATION_FAILED',
              message: result.error,
            },
          };
          res.status(400).json(response);
          return;
        }

        const response: ApiResponse<{
          cart: unknown;
        }> = {
          success: true,
          data: {
            cart: result.cart,
          },
        };

        res.status(200).json(response);
      } catch (error) {
        logger.error('Get cart failed', { error });
        next(error);
      }
    }
  );

  // ============================================
  // Checkout
  // ============================================
  router.post(
    '/checkout',
    validateInternalToken,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const validation = CreateOrderSchema.safeParse(req.body);
        if (!validation.success) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request body',
              details: validation.error.errors,
            },
          };
          res.status(400).json(response);
          return;
        }

        const { sessionId, merchantId, deliveryAddress, metadata } = validation.data;

        // Create order
        const orderResult = await orderService.createOrder({
          sessionId,
          merchantId,
          deliveryAddress: deliveryAddress as any,
          metadata,
        });

        if (!orderResult.success) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'ORDER_CREATION_FAILED',
              message: orderResult.error,
            },
          };
          res.status(400).json(response);
          return;
        }

        // Generate payment link
        const paymentResult = await orderService.generatePaymentLink(
          orderResult.order!.orderId
        );

        const response: ApiResponse<{
          orderId: string;
          total: number;
          paymentLink?: string;
        }> = {
          success: true,
          data: {
            orderId: orderResult.order!.orderId,
            total: orderResult.order!.total,
            paymentLink: paymentResult.paymentLink,
          },
        };

        res.status(201).json(response);
      } catch (error) {
        logger.error('Checkout failed', { error });
        next(error);
      }
    }
  );

  // ============================================
  // Orders
  // ============================================
  router.get(
    '/orders',
    validateInternalToken,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.query.userId as string;
        const merchantId = req.query.merchantId as string;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;

        if (!userId) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'userId is required',
            },
          };
          res.status(400).json(response);
          return;
        }

        const result = await orderService.getUserOrders(userId, {
          merchantId,
          page,
          limit,
        });

        const response: ApiResponse<{
          orders: unknown[];
          page: number;
          limit: number;
          total: number;
        }> = {
          success: true,
          data: {
            orders: result.orders,
            page,
            limit,
            total: result.total,
          },
          meta: {
            page,
            limit,
            total: result.total,
          },
        };

        res.status(200).json(response);
      } catch (error) {
        logger.error('Get orders failed', { error });
        next(error);
      }
    }
  );

  router.get(
    '/orders/:orderId',
    validateInternalToken,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { orderId } = req.params;

        const order = await orderService.getOrder(orderId);

        if (!order) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Order not found',
            },
          };
          res.status(404).json(response);
          return;
        }

        const response: ApiResponse<unknown> = {
          success: true,
          data: order,
        };

        res.status(200).json(response);
      } catch (error) {
        logger.error('Get order failed', { error });
        next(error);
      }
    }
  );

  // ============================================
  // Conversation
  // ============================================
  router.post(
    '/converse',
    validateInternalToken,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { sessionId, message } = req.body;

        if (!sessionId || !message) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'sessionId and message are required',
            },
          };
          res.status(400).json(response);
          return;
        }

        const result = await conversationEngine.processTurn(message, sessionId);

        const response: ApiResponse<{
          reply: string;
          type: string;
          actions?: unknown[];
          state: string;
        }> = {
          success: true,
          data: {
            reply: result.response.message,
            type: result.response.type,
            actions: result.response.actions,
            state: result.session.state,
          },
        };

        res.status(200).json(response);
      } catch (error) {
        logger.error('Conversation failed', { error });
        next(error);
      }
    }
  );

  // ============================================
  // Session End
  // ============================================
  router.post(
    '/session/:sessionId/end',
    validateInternalToken,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { sessionId } = req.params;

        const session = await sessionManager.endSession(sessionId);

        if (!session) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Session not found',
            },
          };
          res.status(404).json(response);
          return;
        }

        const response: ApiResponse<{
          message: string;
        }> = {
          success: true,
          data: {
            message: 'Session ended successfully',
          },
        };

        res.status(200).json(response);
      } catch (error) {
        logger.error('End session failed', { error });
        next(error);
      }
    }
  );

  return router;
}

export default createWhatsAppRoutes;
