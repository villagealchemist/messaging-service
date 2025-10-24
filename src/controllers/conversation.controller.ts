import {Controller, Delete, Get, Path, Queries, Request, Response, Route, SuccessResponse, Tags,} from 'tsoa';
import {Request as ExpressRequest} from 'express';
import {ApiError, ConversationResponse, ConversationWithMessages, PaginationQuery, UUID} from '../models';
import {ConversationService} from '../services/conversation.service';
import {AppError} from '../errors/appError';

/**
 * Controller for managing conversations.
 * Thin layer that delegates to service layer.
 * Catches and formats errors for comprehensive client feedback.
 */
@Route('conversations')
@Tags('Conversations')
export class ConversationController extends Controller {
    /**
     * Returns a paginated list of conversations, ordered by recent activity.
     */
    @Get()
    @SuccessResponse(200, 'Successfully retrieved conversations')
    @Response<ApiError>(500, 'Internal server error')
    public async listConversations(
        @Queries() query: PaginationQuery,
        @Request() request: ExpressRequest
    ): Promise<{ conversations: ConversationResponse[]; total: number }> {
        try {
            const service = new ConversationService(request.logger);
            return await service.listConversations({
                limit: query.limit ?? 50,
                offset: query.offset ?? 0,
            });
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
     * Retrieves a specific conversation by ID.
     * Returns conversation metadata without messages.
     */
    @Get('{conversationId}/metadata')
    @SuccessResponse(200, 'Successfully retrieved conversation')
    @Response<ApiError>(404, 'Conversation not found')
    @Response<ApiError>(500, 'Internal server error')
    public async getConversationMetadata(
        @Path() conversationId: UUID,
        @Request() request: ExpressRequest
    ): Promise<ConversationResponse> {
        try {
            const service = new ConversationService(request.logger);
            return await service.getConversationMetadata(conversationId);
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
     * Retrieves a specific conversation along with its messages (chronologically ordered).
     */
    @Get('{conversationId}/messages')
    @SuccessResponse(200, 'Successfully retrieved conversation with messages')
    @Response<ApiError>(404, 'Conversation not found')
    @Response<ApiError>(500, 'Internal server error')
    public async getConversationHistory(
        @Path() conversationId: UUID,
        @Queries() query: PaginationQuery,
        @Request() request: ExpressRequest
    ): Promise<ConversationWithMessages> {
        try {
            const service = new ConversationService(request.logger);
            return await service.getConversationWithMessages(
                conversationId,
                query.limit ?? 100
            );
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
     * Deletes a conversation and all its associated messages.
     */
    @Delete('{conversationId}')
    @SuccessResponse(204, 'Conversation deleted successfully')
    @Response<ApiError>(404, 'Conversation not found')
    @Response<ApiError>(500, 'Internal server error')
    public async deleteConversation(
        @Path() conversationId: UUID,
        @Request() request: ExpressRequest
    ): Promise<void> {
        try {
            const service = new ConversationService(request.logger);
            await service.deleteConversation(conversationId);
            this.setStatus(204);
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
