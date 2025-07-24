import express, { Request, Response, Router, RequestHandler } from 'express';
import { Client } from 'whatsapp-web.js';
import { WhatsAppService } from './whatsapp-service';
import { MessageStorageService } from './services/message-storage.service';
import { instanceMemoryService } from './instance-manager/services/instance-memory.service';
import { BulkMessageRequest } from './types';
import logger from './logger';
import { createPool, getDatabaseConfig } from './config/database.config';

export function routerFactory(
  client: Client,
  messageStorageService?: MessageStorageService,
  instanceId?: string,
): Router {
  // Create a router instance
  const router: Router = express.Router();
  const whatsappService = new WhatsAppService(client, messageStorageService, instanceId);

  // Get the media storage path from the client configuration
  const mediaStoragePath = (client as any).options?.mediaStoragePath || '.wwebjs_auth/media';

  /**
   * @swagger
   * /api/v1/status:
   *   get:
   *     summary: Get WhatsApp client connection status
   *     responses:
   *       200:
   *         description: Returns the connection status of the WhatsApp client
   */
  router.get('/status', async (_req: Request, res: Response) => {
    try {
      // Отмечаем использование API ключа
      if (instanceId) {
        instanceMemoryService.markApiKeyUsage(instanceId);
      }

      const status = await whatsappService.getStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get client status',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * @swagger
   * /api/v1/health:
   *   get:
   *     summary: Health check endpoint for WhatsApp API
   *     responses:
   *       200:
   *         description: Returns the health status of the WhatsApp API
   *       503:
   *         description: Service is not ready
   */
  router.get('/health', async (_req: Request, res: Response) => {
    try {
      if (!client || !client.info) {
        res.status(503).json({
          status: 'unhealthy',
          provider: 'whatsapp',
          error: 'WhatsApp client not ready',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.json({
        status: 'healthy',
        provider: 'whatsapp',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        provider: 'whatsapp',
        error: 'Health check failed',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * @swagger
   * /api/v1/contacts:
   *   get:
   *     summary: Get all WhatsApp contacts
   *     responses:
   *       200:
   *         description: Returns a list of WhatsApp contacts
   *       500:
   *         description: Server error
   */
  router.get('/contacts', async (_req: Request, res: Response) => {
    try {
      // Отмечаем использование API ключа
      if (instanceId) {
        instanceMemoryService.markApiKeyUsage(instanceId);
      }

      const contacts = await whatsappService.getContacts();
      res.json(contacts);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not ready')) {
        res.status(503).json({ error: error.message });
      } else {
        res.status(500).json({
          error: 'Failed to fetch contacts',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });

  /**
   * @swagger
   * /api/v1/contacts/search:
   *   get:
   *     summary: Search for contacts by name or number
   *     parameters:
   *       - in: query
   *         name: query
   *         schema:
   *           type: string
   *         required: true
   *         description: Search query to find contacts by name or number
   *     responses:
   *       200:
   *         description: Returns matching contacts
   *       500:
   *         description: Server error
   */
  router.get('/contacts/search', async (req: Request, res: Response) => {
    try {
      const query = req.query.query as string;

      if (!query) {
        res.status(400).json({ error: 'Search query is required' });
        return;
      }

      // Отмечаем использование API ключа
      if (instanceId) {
        instanceMemoryService.markApiKeyUsage(instanceId);
      }

      const contacts = await whatsappService.searchContacts(query);
      res.json(contacts);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not ready')) {
        res.status(503).json({ error: error.message });
      } else {
        res.status(500).json({
          error: 'Failed to search contacts',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });

  /**
   * @swagger
   * /api/v1/chats:
   *   get:
   *     summary: Get all WhatsApp chats
   *     responses:
   *       200:
   *         description: Returns a list of WhatsApp chats
   *       500:
   *         description: Server error
   */
  router.get('/chats', async (_req: Request, res: Response) => {
    try {
      // Отмечаем использование API ключа
      if (instanceId) {
        instanceMemoryService.markApiKeyUsage(instanceId);
      }

      const chats = await whatsappService.getChats();
      res.json(chats);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not ready')) {
        res.status(503).json({ error: error.message });
      } else {
        res.status(500).json({
          error: 'Failed to fetch chats',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });

  /**
   * @swagger
   * /api/v1/messages/{number}:
   *   get:
   *     summary: Get messages from a specific chat
   *     parameters:
   *       - in: path
   *         name: number
   *         schema:
   *           type: string
   *         required: true
   *         description: The phone number to get messages from
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *         description: The number of messages to get (default: 10)
   *     responses:
   *       200:
   *         description: Returns messages from the specified chat
   *       404:
   *         description: Number not found on WhatsApp
   *       500:
   *         description: Server error
   */
  router.get('/messages/:number', async (req: Request, res: Response) => {
    try {
      const number = req.params.number;
      const limit = parseInt(req.query.limit as string) || 10;

      // Отмечаем использование API ключа
      if (instanceId) {
        instanceMemoryService.markApiKeyUsage(instanceId);
      }

      const messages = await whatsappService.getMessages(number, limit);
      res.json(messages);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not ready')) {
          res.status(503).json({ error: error.message });
        } else if (error.message.includes('not registered')) {
          res.status(404).json({ error: error.message });
        } else {
          res.status(500).json({
            error: 'Failed to fetch messages',
            details: error.message,
          });
        }
      } else {
        res.status(500).json({
          error: 'Failed to fetch messages',
          details: String(error),
        });
      }
    }
  });

  /**
   * @swagger
   * /api/v1/send:
   *   post:
   *     summary: Send WhatsApp message (text or media)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - number
   *             properties:
   *               number:
   *                 type: string
   *                 description: Phone number to send message
   *               message:
   *                 type: string
   *                 description: Text message content (for text messages)
   *               source:
   *                 type: string
   *                 description: Media URL or file path (for media messages)
   *               caption:
   *                 type: string
   *                 description: Caption for media messages (optional)
   *               mediaType:
   *                 type: string
   *                 enum: [text, image, document, audio, video]
   *                 description: Type of message (auto-detected if not provided)
   *     responses:
   *       200:
   *         description: Message sent successfully
   *       400:
   *         description: Invalid request parameters
   *       404:
   *         description: Number not found on WhatsApp
   *       500:
   *         description: Server error
   */
  router.post('/send', async (req: Request, res: Response) => {
    try {
      const { number, message, source, caption, mediaType } = req.body;

      if (!number) {
        res.status(400).json({ error: 'Number is required' });
        return;
      }

      // Отмечаем использование API ключа
      if (instanceId) {
        instanceMemoryService.markApiKeyUsage(instanceId);
      }

      let result;

      // Автоматическое определение типа сообщения
      const isMediaMessage = source || mediaType !== 'text';

      if (isMediaMessage) {
        // Медиа сообщение
        if (!source) {
          res.status(400).json({
            error: 'Source is required for media messages',
          });
          return;
        }

        result = await whatsappService.sendMediaMessage({
          number,
          source,
          caption: caption || '',
        });
      } else {
        // Текстовое сообщение
        if (!message) {
          res.status(400).json({
            error: 'Message is required for text messages',
          });
          return;
        }

        result = await whatsappService.sendMessage(number, message);
      }

      // Обновляем статистику отправленных сообщений
      if (instanceId && result.messageId) {
        instanceMemoryService.updateMessageStats(instanceId, 'sent');
      }

      res.json({
        ...result,
        messageType: isMediaMessage ? 'media' : 'text',
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not ready')) {
          res.status(503).json({ error: error.message });
        } else if (error.message.includes('not registered')) {
          res.status(404).json({ error: error.message });
        } else {
          res.status(500).json({
            error: 'Failed to send message',
            details: error.message,
          });
        }
      } else {
        res.status(500).json({
          error: 'Failed to send message',
          details: String(error),
        });
      }
    }
  });

  /**
   * @swagger
   * /api/v1/groups:
   *   get:
   *     summary: Get all WhatsApp groups
   *     responses:
   *       200:
   *         description: Returns a list of WhatsApp groups
   *       500:
   *         description: Server error
   */
  router.get('/groups', async (_req: Request, res: Response) => {
    try {
      // Отмечаем использование API ключа
      if (instanceId) {
        instanceMemoryService.markApiKeyUsage(instanceId);
      }

      const groups = await whatsappService.getGroups();
      res.json(groups);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not ready')) {
        res.status(503).json({ error: error.message });
      } else {
        res.status(500).json({
          error: 'Failed to fetch groups',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });

  /**
   * @swagger
   * /api/v1/groups/search:
   *   get:
   *     summary: Search for groups by name, description, or member names
   *     parameters:
   *       - in: query
   *         name: query
   *         schema:
   *           type: string
   *         required: true
   *         description: Search query to find groups by name, description, or member names
   *     responses:
   *       200:
   *         description: Returns matching groups
   *       500:
   *         description: Server error
   */
  router.get('/groups/search', async (req: Request, res: Response) => {
    try {
      const query = req.query.query as string;

      if (!query) {
        res.status(400).json({ error: 'Search query is required' });
        return;
      }

      // Отмечаем использование API ключа
      if (instanceId) {
        instanceMemoryService.markApiKeyUsage(instanceId);
      }

      const groups = await whatsappService.searchGroups(query);
      res.json(groups);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not ready')) {
        res.status(503).json({ error: error.message });
      } else {
        res.status(500).json({
          error: 'Failed to search groups',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });

  /**
   * @swagger
   * /api/v1/groups:
   *   post:
   *     summary: Create a new WhatsApp group
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - participants
   *             properties:
   *               name:
   *                 type: string
   *                 description: The name of the group to create
   *               participants:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Array of phone numbers to add to the group
   *     responses:
   *       200:
   *         description: Group created successfully
   *       400:
   *         description: Invalid request parameters
   *       500:
   *         description: Server error
   */
  router.post('/groups', async (req: Request, res: Response) => {
    try {
      const { name, participants } = req.body;

      if (!name || !participants || !Array.isArray(participants)) {
        res.status(400).json({ error: 'Name and array of participants are required' });
        return;
      }

      // Отмечаем использование API ключа
      if (instanceId) {
        instanceMemoryService.markApiKeyUsage(instanceId);
      }

      const result = await whatsappService.createGroup(name, participants);
      res.json(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not ready')) {
        res.status(503).json({ error: error.message });
      } else {
        res.status(500).json({
          error: 'Failed to create group',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });

  /**
   * @swagger
   * /api/v1/groups/{groupId}:
   *   get:
   *     summary: Get a specific WhatsApp group by ID
   *     parameters:
   *       - in: path
   *         name: groupId
   *         schema:
   *           type: string
   *         required: true
   *         description: The ID of the group to get
   *     responses:
   *       200:
   *         description: Returns the group details
   *       404:
   *         description: Group not found
   *       500:
   *         description: Server error
   */
  router.get('/groups/:groupId', async (req: Request, res: Response) => {
    try {
      const groupId = req.params.groupId;

      // Отмечаем использование API ключа
      if (instanceId) {
        instanceMemoryService.markApiKeyUsage(instanceId);
      }

      const group = await whatsappService.getGroupById(groupId);
      res.json(group);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not ready')) {
          res.status(503).json({ error: error.message });
        } else if (error.message.includes('not found') || error.message.includes('invalid chat')) {
          res.status(404).json({ error: error.message });
        } else {
          res.status(500).json({
            error: 'Failed to fetch group',
            details: error.message,
          });
        }
      } else {
        res.status(500).json({
          error: 'Failed to fetch group',
          details: String(error),
        });
      }
    }
  });

  /**
   * @swagger
   * /api/v1/groups/{groupId}/messages:
   *   get:
   *     summary: Get messages from a specific group
   *     parameters:
   *       - in: path
   *         name: groupId
   *         schema:
   *           type: string
   *         required: true
   *         description: The ID of the group to get messages from
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *         description: The number of messages to get (default: 10)
   *     responses:
   *       200:
   *         description: Returns messages from the specified group
   *       404:
   *         description: Group not found
   *       500:
   *         description: Server error
   */
  router.get('/groups/:groupId/messages', async (req: Request, res: Response) => {
    try {
      const groupId = req.params.groupId;
      const limit = parseInt(req.query.limit as string) || 10;

      // Отмечаем использование API ключа
      if (instanceId) {
        instanceMemoryService.markApiKeyUsage(instanceId);
      }

      const messages = await whatsappService.getGroupMessages(groupId, limit);
      res.json(messages);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not ready')) {
          res.status(503).json({ error: error.message });
        } else if (error.message.includes('not found') || error.message.includes('invalid chat')) {
          res.status(404).json({ error: error.message });
        } else {
          res.status(500).json({
            error: 'Failed to fetch group messages',
            details: error.message,
          });
        }
      } else {
        res.status(500).json({
          error: 'Failed to fetch group messages',
          details: String(error),
        });
      }
    }
  });

  /**
   * @swagger
   * /api/v1/groups/{groupId}/participants/add:
   *   post:
   *     summary: Add participants to a WhatsApp group
   *     parameters:
   *       - in: path
   *         name: groupId
   *         schema:
   *           type: string
   *         required: true
   *         description: The ID of the group to add participants to
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - participants
   *             properties:
   *               participants:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Array of phone numbers to add to the group
   *     responses:
   *       200:
   *         description: Participants added successfully
   *       400:
   *         description: Invalid request parameters
   *       404:
   *         description: Group not found
   *       500:
   *         description: Server error
   */
  router.post('/groups/:groupId/participants/add', async (req: Request, res: Response) => {
    try {
      const groupId = req.params.groupId;
      const { participants } = req.body;

      if (!participants || !Array.isArray(participants)) {
        res.status(400).json({ error: 'Array of participants is required' });
        return;
      }

      // Отмечаем использование API ключа
      if (instanceId) {
        instanceMemoryService.markApiKeyUsage(instanceId);
      }

      const result = await whatsappService.addParticipantsToGroup(groupId, participants);
      res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not ready')) {
          res.status(503).json({ error: error.message });
        } else if (
          error.message.includes('not found') ||
          error.message.includes('not a group chat')
        ) {
          res.status(404).json({ error: error.message });
        } else if (error.message.includes('not supported')) {
          res.status(501).json({ error: error.message });
        } else {
          res.status(500).json({
            error: 'Failed to add participants to group',
            details: error.message,
          });
        }
      } else {
        res.status(500).json({
          error: 'Failed to add participants to group',
          details: String(error),
        });
      }
    }
  });

  /**
   * @swagger
   * /api/v1/groups/{groupId}/send:
   *   post:
   *     summary: Send a message to a WhatsApp group
   *     parameters:
   *       - in: path
   *         name: groupId
   *         schema:
   *           type: string
   *         required: true
   *         description: The ID of the group to send the message to
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - message
   *             properties:
   *               message:
   *                 type: string
   *                 description: The message content to send
   *     responses:
   *       200:
   *         description: Message sent successfully
   *       404:
   *         description: Group not found
   *       500:
   *         description: Server error
   */
  router.post('/groups/:groupId/send', async (req: Request, res: Response) => {
    try {
      const groupId = req.params.groupId;
      const { message } = req.body;

      if (!groupId || !message) {
        res.status(400).json({ error: 'Group ID and message are required' });
        return;
      }

      // Отмечаем использование API ключа
      if (instanceId) {
        instanceMemoryService.markApiKeyUsage(instanceId);
      }

      const result = await whatsappService.sendGroupMessage(groupId, message);

      // Обновляем статистику отправленных сообщений
      if (instanceId && result.messageId) {
        instanceMemoryService.updateMessageStats(instanceId, 'sent');
      }

      res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not ready')) {
          res.status(503).json({ error: error.message });
        } else if (error.message.includes('not found') || error.message.includes('invalid chat')) {
          res.status(404).json({ error: error.message });
        } else {
          res.status(500).json({
            error: 'Failed to send group message',
            details: error.message,
          });
        }
      } else {
        res.status(500).json({
          error: 'Failed to send group message',
          details: String(error),
        });
      }
    }
  });

  /**
   * @swagger
   * /api/v1/messages/{messageId}/media/download:
   *   post:
   *     summary: Download media from a message
   *     parameters:
   *       - in: path
   *         name: messageId
   *         required: true
   *         description: ID of the message containing media
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Returns the downloaded media file information
   *       404:
   *         description: Message not found or does not contain media
   *       500:
   *         description: Server error
   */
  router.post('/messages/:messageId/media/download', async (req: Request, res: Response) => {
    try {
      const { messageId } = req.params;

      if (!messageId) {
        res.status(400).json({ error: 'Message ID is required' });
        return;
      }

      // Отмечаем использование API ключа
      if (instanceId) {
        instanceMemoryService.markApiKeyUsage(instanceId);
      }

      const mediaInfo = await whatsappService.downloadMediaFromMessage(messageId, mediaStoragePath);
      res.json(mediaInfo);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not ready')) {
          res.status(503).json({ error: error.message });
        } else if (
          error.message.includes('not found') ||
          error.message.includes('does not contain media')
        ) {
          res.status(404).json({ error: error.message });
        } else {
          logger.error('Failed to download media', { error });
          res.status(500).json({
            error: 'Failed to download media',
            details: error.message,
          });
        }
      } else {
        logger.error('Failed to download media', { error });
        res.status(500).json({
          error: 'Failed to download media',
          details: String(error),
        });
      }
    }
  });

  /**
   * @swagger
   * /api/v1/send/media:
   *   post:
   *     summary: Send a media message to a WhatsApp contact
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - number
   *               - source
   *             properties:
   *               number:
   *                 type: string
   *                 description: The phone number to send the message to
   *               source:
   *                 type: string
   *                 description: The source of the media - URLs must use http:// or https:// prefixes, local files must use file:// prefix (e.g., 'https://example.com/image.jpg' or 'file:///path/to/image.jpg')
   *               caption:
   *                 type: string
   *                 description: caption for the media
   *     responses:
   *       200:
   *         description: Media message sent successfully
   *       400:
   *         description: Invalid request parameters
   *       404:
   *         description: Number not found on WhatsApp
   *       500:
   *         description: Server error
   */
  router.post('/send/media', async (req: Request, res: Response) => {
    try {
      const { number, source, caption = '' } = req.body;

      // Validate required parameters
      if (!number || !source) {
        res.status(400).json({ error: 'Number and source are required' });
        return;
      }

      // Отмечаем использование API ключа
      if (instanceId) {
        instanceMemoryService.markApiKeyUsage(instanceId);
      }

      const result = await whatsappService.sendMediaMessage({
        number,
        source,
        caption,
      });

      // Обновляем статистику отправленных сообщений
      if (instanceId && result.messageId) {
        instanceMemoryService.updateMessageStats(instanceId, 'sent');
      }

      res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not ready')) {
          res.status(503).json({ error: error.message });
        } else if (error.message.includes('not registered')) {
          res.status(404).json({ error: error.message });
        } else {
          res.status(500).json({
            error: 'Failed to send media message',
            details: error.message,
          });
        }
      } else {
        res.status(500).json({
          error: 'Failed to send media message',
          details: String(error),
        });
      }
    }
  });

  // Новые эндпоинты согласно пункту 9 плана разработки

  /**
   * @swagger
   * /api/v1/account-info:
   *   get:
   *     summary: Get account information
   *     tags: [Account]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Account information
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     account:
   *                       type: string
   *                     provider:
   *                       type: string
   *                     created_at:
   *                       type: string
   *                     updated_at:
   *                       type: string
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Instance not found
   *       500:
   *         description: Server error
   */
  const getAccountInfo: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
    try {
      if (instanceId) {
        instanceMemoryService.markApiKeyUsage(instanceId);
      }

      const pool = createPool();
      const config = getDatabaseConfig();
      const result = await pool.query(
        `SELECT account, provider, created_at, updated_at 
         FROM ${config.schema}.message_instances 
         WHERE id = $1`,
        [instanceId],
      );

      if (result.rows.length > 0) {
        res.json({ success: true, data: result.rows[0] });
      } else {
        res.status(404).json({ success: false, error: 'Instance not found' });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get account info',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  };

  /**
   * @swagger
   * /api/v1/webhook/config:
   *   post:
   *     summary: Update webhook configuration
   *     tags: [Webhook]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - url
   *             properties:
   *               url:
   *                 type: string
   *                 description: Webhook URL
   *               headers:
   *                 type: object
   *                 description: Additional headers
   *               enabled:
   *                 type: boolean
   *                 default: true
   *     responses:
   *       200:
   *         description: Webhook configuration updated
   *       400:
   *         description: Bad request
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Server error
   */
  const updateWebhookConfig: RequestHandler = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      if (instanceId) {
        instanceMemoryService.markApiKeyUsage(instanceId);
      }

      const { url, headers, enabled = true } = req.body;

      if (!url) {
        res.status(400).json({
          success: false,
          error: 'Webhook URL is required',
        });
        return;
      }

      const webhookConfig = { url, headers: headers || {}, enabled };

      const pool = createPool();
      const config = getDatabaseConfig();
      await pool.query(
        `UPDATE ${config.schema}.message_instances 
         SET api_webhook_schema = $1, updated_at = NOW() 
         WHERE id = $2`,
        [JSON.stringify(webhookConfig), instanceId],
      );

      res.json({
        success: true,
        message: 'Webhook configuration updated',
        data: webhookConfig,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to update webhook config',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  };

  /**
   * @swagger
   * /api/v1/webhook/config:
   *   get:
   *     summary: Get webhook configuration
   *     tags: [Webhook]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Webhook configuration
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Instance not found
   *       500:
   *         description: Server error
   */
  const getWebhookConfig: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
    try {
      if (instanceId) {
        instanceMemoryService.markApiKeyUsage(instanceId);
      }

      const pool = createPool();
      const config = getDatabaseConfig();
      const result = await pool.query(
        `SELECT api_webhook_schema 
         FROM ${config.schema}.message_instances 
         WHERE id = $1`,
        [instanceId],
      );

      if (result.rows.length > 0) {
        res.json({
          success: true,
          data: result.rows[0].api_webhook_schema || {},
        });
      } else {
        res.status(404).json({ success: false, error: 'Instance not found' });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get webhook config',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  };

  // Новые эндпоинты для работы с сохраненными сообщениями
  if (messageStorageService && instanceId) {
    /**
     * @swagger
     * /api/v1/stored-messages:
     *   get:
     *     summary: Get stored messages for the current instance
     *     parameters:
     *       - in: query
     *         name: chatId
     *         schema:
     *           type: string
     *         description: Filter by specific chat ID
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *         description: Number of messages to retrieve (default: 50)
     *       - in: query
     *         name: offset
     *         schema:
     *           type: integer
     *         description: Number of messages to skip (default: 0)
     *       - in: query
     *         name: isGroup
     *         schema:
     *           type: boolean
     *         description: Filter by group messages (true) or private messages (false)
     *     responses:
     *       200:
     *         description: Returns stored messages
     *       500:
     *         description: Server error
     */
    router.get('/stored-messages', async (req: Request, res: Response) => {
      try {
        const chatId = req.query.chatId as string;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;
        const isGroup =
          req.query.isGroup === 'true' ? true : req.query.isGroup === 'false' ? false : undefined;

        // Отмечаем использование API ключа
        if (instanceId) {
          instanceMemoryService.markApiKeyUsage(instanceId);
        }

        const messages = await messageStorageService.getMessages(instanceId, {
          chatId,
          limit,
          offset,
          isGroup,
        });

        res.json({
          success: true,
          data: messages,
          count: messages.length,
          pagination: {
            limit,
            offset,
          },
        });
      } catch (error) {
        logger.error('Failed to get stored messages', { error });
        res.status(500).json({
          success: false,
          error: 'Failed to get stored messages',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    /**
     * @swagger
     * /api/v1/stored-messages/stats:
     *   get:
     *     summary: Get message statistics for the current instance
     *     responses:
     *       200:
     *         description: Returns message statistics
     *       500:
     *         description: Server error
     */
    router.get('/stored-messages/stats', async (_req: Request, res: Response) => {
      try {
        // Отмечаем использование API ключа
        if (instanceId) {
          instanceMemoryService.markApiKeyUsage(instanceId);
        }

        const stats = await messageStorageService.getMessageStats(instanceId);

        res.json({
          success: true,
          data: stats,
        });
      } catch (error) {
        logger.error('Failed to get message stats', { error });
        res.status(500).json({
          success: false,
          error: 'Failed to get message stats',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    /**
     * @swagger
     * /api/v1/stored-messages/cleanup:
     *   post:
     *     summary: Clean up old messages for the current instance
     *     requestBody:
     *       required: false
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               daysToKeep:
     *                 type: integer
     *                 description: Number of days to keep messages (default: 30)
     *     responses:
     *       200:
     *         description: Returns cleanup results
     *       500:
     *         description: Server error
     */
    router.post('/stored-messages/cleanup', async (req: Request, res: Response) => {
      try {
        // Отмечаем использование API ключа
        if (instanceId) {
          instanceMemoryService.markApiKeyUsage(instanceId);
        }

        const daysToKeep = parseInt(req.body?.daysToKeep) || 30;
        const deletedCount = await messageStorageService.cleanupOldMessages(instanceId, daysToKeep);

        res.json({
          success: true,
          data: {
            deletedCount,
            daysToKeep,
          },
          message: `Cleaned up ${deletedCount} old messages`,
        });
      } catch (error) {
        logger.error('Failed to cleanup old messages', { error });
        res.status(500).json({
          success: false,
          error: 'Failed to cleanup old messages',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  router.get('/account-info', getAccountInfo);
  router.post('/webhook/config', updateWebhookConfig);
  router.get('/webhook/config', getWebhookConfig);

  /**
   * @swagger
   * /api/v1/send-bulk:
   *   post:
   *     summary: Send bulk WhatsApp messages
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - recipients
   *               - message
   *             properties:
   *               recipients:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     to:
   *                       type: string
   *                       description: Phone number
   *                     name:
   *                       type: string
   *                       description: Contact name (optional)
   *                     customMessage:
   *                       type: string
   *                       description: Custom message for this recipient (optional)
   *               message:
   *                 type: string
   *                 description: Message template with variables like {name}, {phone}
   *               delayBetweenMessages:
   *                 type: number
   *                 description: Delay between messages in milliseconds (default 1000)
   *               templateVariables:
   *                 type: object
   *                 description: Variables to replace in message template
   *               failureStrategy:
   *                 type: string
   *                 enum: [continue, abort]
   *                 description: What to do on failure (default continue)
   *               retryAttempts:
   *                 type: number
   *                 description: Number of retry attempts (default 1)
   *     responses:
   *       200:
   *         description: Bulk message results
   *       400:
   *         description: Invalid request
   *       500:
   *         description: Server error
   */
  router.post('/send-bulk', async (req: Request, res: Response) => {
    try {
      const bulkRequest: BulkMessageRequest = req.body;

      // Валидация
      if (
        !bulkRequest.recipients ||
        !Array.isArray(bulkRequest.recipients) ||
        bulkRequest.recipients.length === 0
      ) {
        res.status(400).json({
          error: 'Recipients array is required and must not be empty',
        });
        return;
      }

      if (!bulkRequest.message || typeof bulkRequest.message !== 'string') {
        res.status(400).json({
          error: 'Message is required and must be a string',
        });
        return;
      }

      // Ограничение на количество получателей
      if (bulkRequest.recipients.length > 100) {
        res.status(400).json({
          error: 'Maximum 100 recipients allowed per bulk message',
        });
        return;
      }

      // Валидация получателей
      for (const recipient of bulkRequest.recipients) {
        if (!recipient.to || typeof recipient.to !== 'string') {
          res.status(400).json({
            error: 'Each recipient must have a valid "to" field',
          });
          return;
        }
      }

      // Отмечаем использование API ключа
      if (instanceId) {
        instanceMemoryService.markApiKeyUsage(instanceId);
      }

      // Выполняем массовую рассылку через WhatsApp сервис
      const result = await whatsappService.sendBulkMessages(bulkRequest);

      // Обновляем статистику отправленных сообщений
      if (instanceId && result.successCount > 0) {
        for (let i = 0; i < result.successCount; i++) {
          instanceMemoryService.updateMessageStats(instanceId, 'sent');
        }
      }

      res.json(result);
    } catch (error) {
      logger.error('Error in bulk message endpoint:', error);
      res.status(500).json({
        error: 'Failed to send bulk messages',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}
