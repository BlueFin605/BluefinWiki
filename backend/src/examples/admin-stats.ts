/**
 * Example Lambda: Admin-Only Endpoint
 * 
 * This endpoint demonstrates how to restrict access to admin users only.
 * It uses both withAuth and withRole middleware.
 * 
 * Endpoint: GET /admin/stats
 * Auth: Required (Admin only)
 */

import { APIGatewayProxyResult } from 'aws-lambda';
import { withAuth, withRole, getUserContext, AuthenticatedEvent } from '../middleware/auth';

export const handler = withAuth(
  withRole(['Admin'], async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
    console.log('Admin stats request received');

    try {
      const user = getUserContext(event);

      console.log('Admin user authenticated:', {
        userId: user.userId,
        email: user.email,
      });

      // Example: Return some admin-only statistics
      const stats = {
        totalUsers: 42,
        totalPages: 128,
        totalFolders: 15,
        storageUsed: '45.2 MB',
        lastBackup: new Date().toISOString(),
      };

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(stats),
      };
    } catch (error) {
      console.error('Error getting admin stats:', error);

      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to retrieve statistics' }),
      };
    }
  })
);
