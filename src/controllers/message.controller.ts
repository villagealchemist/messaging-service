import {
    Controller,
    Post,
    Route,
    Tags,
    Body,
    Response,
    SuccessResponse,
    Request,
} from 'tsoa';
import { Request as ExpressRequest } from 'express';
import { MessageService } from '../services/message.service';
import {
    OutboundSmsRequest,
    OutboundEmailRequest,
    InboundSmsWebhook,
    InboundEmailWebhook,
    MessageResponse,
    ApiError,
} from '../models';
import { AppError, ValidationError } from '../errors/appError';

/**
 * Controller for outbound messages.
 * Thin layer that delegates to service layer.
 * Catches and formats errors for comprehensive client feedback.
 */
@Route('messages')
@Tags('Messages')
export class MessageController extends Controller {
    /**
     * Sends an SMS or MMS message via provider.
     */
    @Post('sms')
    @SuccessResponse(201, 'Message sent successfully')
    @Response<ApiError>(400, 'Validation failed')
    @Response<ApiError>(500, 'Internal Server Error')
    public async sendSms(
        @Body() requestBody: OutboundSmsRequest,
        @Request() request: ExpressRequest
    ): Promise<MessageResponse> {
        try {
            const service = new MessageService(request.logger);

            const message = await service.sendMessage({
                from: requestBody.from,
                to: requestBody.to,
                body: requestBody.body,
                attachments: requestBody.attachments,
                providerType: 'sms',
                messageType: requestBody.type,
                direction: 'outbound',
                timestamp: new Date(requestBody.timestamp),
            });

            this.setStatus(201);
            return message;
        } catch (error) {
            if (error instanceof AppError) {
                this.setStatus(error.status);
                throw {
                    message: error.message,
                    code: error.code,
                    details: error.details,
                };
            }
            throw error;
        }
    }

    /**
     * Sends an email message via provider.
     */
    @Post('email')
    @SuccessResponse(201, 'Email sent successfully')
    @Response<ApiError>(400, 'Validation failed')
    @Response<ApiError>(500, 'Internal Server Error')
    public async sendEmail(
        @Body() requestBody: OutboundEmailRequest,
        @Request() request: ExpressRequest
    ): Promise<MessageResponse> {
        try {
            const service = new MessageService(request.logger);

            const message = await service.sendMessage({
                from: requestBody.from,
                to: requestBody.to,
                body: requestBody.body,
                attachments: requestBody.attachments,
                providerType: 'email',
                messageType: 'email',
                direction: 'outbound',
                timestamp: new Date(requestBody.timestamp),
            });

            this.setStatus(201);
            return message;
        } catch (error) {
            if (error instanceof AppError) {
                this.setStatus(error.status);
                throw {
                    message: error.message,
                    code: error.code,
                    details: error.details,
                };
            }
            throw error;
        }
    }
}

/**
 * Controller for inbound webhooks.
 * Thin layer that delegates to service layer.
 * Catches and formats errors for comprehensive client feedback.
 */
@Route('webhooks')
@Tags('Webhooks')
export class WebhookController extends Controller {
    /**
     * Receives inbound SMS/MMS messages from provider.
     */
    @Post('sms')
    @SuccessResponse(200, 'Webhook processed')
    @Response<ApiError>(400, 'Validation failed')
    @Response<ApiError>(500, 'Internal Server Error')
    public async receiveSms(
        @Body() webhook: InboundSmsWebhook,
        @Request() request: ExpressRequest
    ): Promise<MessageResponse> {
        try {
            const service = new MessageService(request.logger);

            const message = await service.sendMessage({
                from: webhook.from,
                to: webhook.to,
                body: webhook.body,
                attachments: webhook.attachments,
                providerType: 'sms',
                messageType: webhook.type,
                direction: 'inbound',
                providerMessageId: webhook.messaging_provider_id,
                timestamp: new Date(webhook.timestamp),
            });

            this.setStatus(200);
            return message;
        } catch (error) {
            if (error instanceof AppError) {
                this.setStatus(error.status);
                throw {
                    message: error.message,
                    code: error.code,
                    details: error.details,
                };
            }
            throw error;
        }
    }

    /**
     * Receives inbound email messages from provider.
     */
    @Post('email')
    @SuccessResponse(200, 'Webhook processed')
    @Response<ApiError>(400, 'Validation failed')
    @Response<ApiError>(500, 'Internal Server Error')
    public async receiveEmail(
        @Body() webhook: InboundEmailWebhook,
        @Request() request: ExpressRequest
    ): Promise<MessageResponse> {
        try {
            const service = new MessageService(request.logger);

            const message = await service.sendMessage({
                from: webhook.from,
                to: webhook.to,
                body: webhook.body,
                attachments: webhook.attachments,
                providerType: 'email',
                messageType: 'email',
                direction: 'inbound',
                providerMessageId: webhook.xillio_id,
                timestamp: new Date(webhook.timestamp),
            });

            this.setStatus(200);
            return message;
        } catch (error) {
            if (error instanceof AppError) {
                this.setStatus(error.status);
                throw {
                    message: error.message,
                    code: error.code,
                    details: error.details,
                };
            }
            throw error;
        }
    }
}
