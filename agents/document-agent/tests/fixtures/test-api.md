---
title: TukTuk API Documentation
description: Markdown-based API documentation for testing
baseUrl: https://api.tuktuk.baghdad
---

# TukTuk API Documentation

This document describes the TukTuk API endpoints.

## GET /api/users

Retrieve a list of all users in the system.

This endpoint returns paginated user data with optional filtering.

### Parameters

- `page` (number) - Page number (default: 1)
- `limit` (number) - Items per page (default: 10, max: 100)
- `search` (string) - Search query for filtering users

### Authentication

Requires JWT token in Authorization header.

### Response

```json
{
  "data": [
    {
      "id": "usr_123",
      "email": "user@example.com",
      "name": "Ahmed Ali",
      "phone": "+9647701234567"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 10
}
```

## POST /api/rides

Create a new ride request.

### Request Body

```json
{
  "userId": "usr_123",
  "pickupLocation": {
    "lat": 33.3152,
    "lng": 44.3661,
    "address": "Baghdad, Iraq"
  },
  "dropoffLocation": {
    "lat": 33.3400,
    "lng": 44.4009,
    "address": "Karrada, Baghdad"
  }
}
```

### Response

```json
{
  "id": "ride_456",
  "userId": "usr_123",
  "status": "pending",
  "pickupLocation": {
    "lat": 33.3152,
    "lng": 44.3661
  },
  "dropoffLocation": {
    "lat": 33.3400,
    "lng": 44.4009
  },
  "estimatedFare": 5000,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

## DELETE /api/rides/{rideId}

Cancel a ride request.

### Parameters

- `rideId` (string, required) - The ID of the ride to cancel

### Response

```json
{
  "success": true,
  "message": "Ride cancelled successfully"
}
```

## PUT /api/users/{userId}

Update user profile information.

### Parameters

- `userId` (string, required) - The ID of the user to update

### Request Body

```json
{
  "name": "Ahmed Ali Updated",
  "phone": "+9647701234567"
}
```

### Response

```json
{
  "id": "usr_123",
  "email": "user@example.com",
  "name": "Ahmed Ali Updated",
  "phone": "+9647701234567",
  "updatedAt": "2024-01-15T10:35:00Z"
}
```
