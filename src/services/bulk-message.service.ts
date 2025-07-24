import {
  BulkMessageRequest,
  BulkMessageResponse,
  BulkMessageResult,
  BulkMessageStatus,
  BulkMessageRecipient,
} from '../types';
import logger from '../logger';
import { v4 as uuidv4 } from 'uuid';

export class BulkMessageService {
  private activeBulkMessages: Map<string, BulkMessageStatus> = new Map();

  /**
   * Обработка шаблонов в сообщении
   */
  private processTemplate(
    message: string,
    templateVariables?: Record<string, string>,
    recipient?: BulkMessageRecipient,
  ): string {
    let processedMessage = message;

    // Замена переменных шаблона
    if (templateVariables) {
      Object.entries(templateVariables).forEach(([key, value]) => {
        const regex = new RegExp(`\\{${key}\\}`, 'g');
        processedMessage = processedMessage.replace(regex, value);
      });
    }

    // Замена данных получателя
    if (recipient?.name) {
      processedMessage = processedMessage.replace(/\{name\}/g, recipient.name);
    }
    processedMessage = processedMessage.replace(/\{phone\}/g, recipient?.to || '');

    return processedMessage;
  }

  /**
   * Создание статуса массовой рассылки
   */
  private createBulkStatus(request: BulkMessageRequest): { id: string; status: BulkMessageStatus } {
    const id = uuidv4();
    const status: BulkMessageStatus = {
      id,
      status: 'pending',
      progress: {
        processed: 0,
        total: request.recipients.length,
        percentage: 0,
      },
      startTime: Date.now(),
    };

    this.activeBulkMessages.set(id, status);
    return { id, status };
  }

  /**
   * Обновление статуса массовой рассылки
   */
  private updateBulkStatus(id: string, updates: Partial<BulkMessageStatus>): void {
    const status = this.activeBulkMessages.get(id);
    if (status) {
      Object.assign(status, updates);

      // Обновляем процент выполнения
      if (status.progress) {
        status.progress.percentage = Math.round(
          (status.progress.processed / status.progress.total) * 100,
        );
      }

      this.activeBulkMessages.set(id, status);
    }
  }

  /**
   * Получить статус массовой рассылки
   */
  getBulkStatus(id: string): BulkMessageStatus | null {
    return this.activeBulkMessages.get(id) || null;
  }

  /**
   * Получить все активные массовые рассылки
   */
  getActiveBulkMessages(): BulkMessageStatus[] {
    return Array.from(this.activeBulkMessages.values());
  }

  /**
   * Отмена массовой рассылки
   */
  cancelBulkMessage(id: string): boolean {
    const status = this.activeBulkMessages.get(id);
    if (status && (status.status === 'pending' || status.status === 'running')) {
      this.updateBulkStatus(id, {
        status: 'cancelled',
        endTime: Date.now(),
      });
      return true;
    }
    return false;
  }

  /**
   * Выполнение массовой рассылки с помощью функции отправки
   */
  async executeBulkMessage(
    request: BulkMessageRequest,
    sendMessageFn: (to: string, message: string) => Promise<{ messageId?: string; error?: string }>,
  ): Promise<BulkMessageResponse> {
    const { id, status } = this.createBulkStatus(request);

    // Настройки по умолчанию
    const delayBetweenMessages = request.delayBetweenMessages || 1000;
    const failureStrategy = request.failureStrategy || 'continue';
    const retryAttempts = request.retryAttempts || 1;

    const results: BulkMessageResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    try {
      this.updateBulkStatus(id, { status: 'running' });

      for (let i = 0; i < request.recipients.length; i++) {
        const recipient = request.recipients[i];

        // Проверяем, не была ли отменена рассылка
        const currentStatus = this.activeBulkMessages.get(id);
        if (currentStatus?.status === 'cancelled') {
          break;
        }

        // Используем кастомное сообщение или обрабатываем шаблон
        const messageToSend =
          recipient.customMessage ||
          this.processTemplate(request.message, request.templateVariables, recipient);

        let attempts = 0;
        let lastError = '';
        let messageId = '';
        let success = false;

        // Попытки отправки с повторами
        while (attempts < retryAttempts && !success) {
          attempts++;

          try {
            const result = await sendMessageFn(recipient.to, messageToSend);

            if (result.error) {
              lastError = result.error;
            } else {
              success = true;
              messageId = result.messageId || '';
            }
          } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
          }

          // Если не удалось отправить и есть еще попытки, ждем перед повтором
          if (!success && attempts < retryAttempts) {
            await this.delay(500); // Короткая задержка перед повтором
          }
        }

        // Сохраняем результат
        const result: BulkMessageResult = {
          recipient: recipient.to,
          success,
          messageId: success ? messageId : undefined,
          error: success ? undefined : lastError,
          attempts,
          timestamp: Date.now(),
        };

        results.push(result);

        if (success) {
          successCount++;
        } else {
          failureCount++;

          // Если стратегия "abort" и произошла ошибка, прерываем рассылку
          if (failureStrategy === 'abort') {
            logger.warn(
              `Bulk message aborted due to failure strategy. Failed on recipient: ${recipient.to}`,
            );
            break;
          }
        }

        // Обновляем прогресс
        this.updateBulkStatus(id, {
          progress: {
            processed: i + 1,
            total: request.recipients.length,
            percentage: Math.round(((i + 1) / request.recipients.length) * 100),
          },
          results: [...results],
        });

        // Задержка между сообщениями (кроме последнего)
        if (i < request.recipients.length - 1) {
          await this.delay(delayBetweenMessages);
        }
      }

      const endTime = Date.now();
      const startTime = status.startTime!;

      // Финальное обновление статуса
      this.updateBulkStatus(id, {
        status: 'completed',
        endTime,
        results,
      });

      const response: BulkMessageResponse = {
        success: failureCount === 0,
        totalRecipients: request.recipients.length,
        successCount,
        failureCount,
        results,
        startTime,
        endTime,
        totalDuration: endTime - startTime,
      };

      // Логируем результат
      logger.info('Bulk message completed', {
        bulkId: id,
        totalRecipients: response.totalRecipients,
        successCount: response.successCount,
        failureCount: response.failureCount,
        duration: response.totalDuration,
      });

      return response;
    } catch (error) {
      this.updateBulkStatus(id, {
        status: 'failed',
        endTime: Date.now(),
      });

      logger.error('Bulk message failed', error);
      throw error;
    }
  }

  /**
   * Утилита для задержки
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Очистка завершенных рассылок (вызывается периодически)
   */
  cleanupCompletedBulkMessages(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();

    for (const [id, status] of this.activeBulkMessages.entries()) {
      if (
        (status.status === 'completed' ||
          status.status === 'failed' ||
          status.status === 'cancelled') &&
        status.endTime &&
        now - status.endTime > maxAge
      ) {
        this.activeBulkMessages.delete(id);
      }
    }
  }
}

// Singleton экземпляр
export const bulkMessageService = new BulkMessageService();
