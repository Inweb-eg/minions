---
title: React Admin Dashboard Documentation
description: React documentation for TukTuk admin dashboard
framework: react
reactVersion: 18.2.0
---

# React Admin Dashboard Documentation

This document describes the React implementation for the TukTuk admin dashboard.

## State Management

The application uses **Redux** with Redux Toolkit for centralized state management.

For routing, we use **React Router v6** with nested routes and protected route patterns.

The UI is built with **Material-UI (MUI)** v5 for consistent design.

## Pages

### Dashboard Page (Functional)

Main analytics and overview page showing key metrics.

**Route:** /dashboard
**Type:** Functional Component

**Components:**
- StatsCards - Display key metrics
- RidesChart - Visualization of ride data
- RevenueGraph - Revenue analytics

**Hooks:** useState, useEffect, useSelector

### Rides Management Page

Page for managing and monitoring active rides.

**Route:** /rides
**Components:** RidesTable, RideDetails, FilterBar

### Users Page (Functional)

User management interface for viewing and editing user data.

**Route:** /users

## Components

### StatsCard (Functional)

Reusable card component for displaying statistical information.

**Type:** Functional
**Props:**
- title: string
- value: number
- change: number
- icon: ReactNode

**Hooks:** useMemo

### RidesTable (Functional)

Data table displaying ride information with sorting and filtering.

**Props:**
- rides: Ride[]
- onRowClick: (id: string) => void
- loading: boolean

**Hooks:** useState, useEffect, useCallback

### UserForm (Class Component)

Form component for creating and editing user profiles.

**Type:** Class
**Props:** userId, onSave, onCancel

## Custom Hooks

### useAuth

Custom hook for handling authentication logic.

**Returns:** { user, login, logout, isAuthenticated }

**Dependencies:** useContext, useState, useEffect

### usePagination

Hook for managing table pagination state.

**Parameters:**
- initialPage: number
- pageSize: number

**Returns:** { page, setPage, pageSize, setPageSize }

### useDebounce

Debounces a value with specified delay.

**Parameters:**
- value: any
- delay: number

**Returns:** debouncedValue

## Contexts

### AuthContext

Provides authentication state and methods throughout the app.

**Provides:**
- currentUser
- login
- logout
- updateProfile

**Consumers:** PrivateRoute, Header, ProfilePage

### ThemeContext

Manages application theme (light/dark mode).

**Provides:**
- theme: 'light' | 'dark'
- toggleTheme: () => void

## Services

### RideService (API)

Handles ride-related API calls.

**Methods:**
- getAllRides()
- getRideById(id)
- updateRideStatus(id, status)
- assignDriver(rideId, driverId)

### AuthService (Authentication)

Manages authentication and user sessions.

**Methods:**
- login(credentials)
- logout()
- refreshToken()
- getCurrentUser()

### WebSocketService (WebSocket)

Real-time communication for live ride updates.

**Methods:**
- connect()
- disconnect()
- subscribe(channel)
- send(message)

## Routes

- /dashboard - DashboardPage
- /rides - RidesManagementPage
- /rides/:id - RideDetailsPage
- /users - UsersPage
- /users/:id - UserDetailsPage
- /settings - SettingsPage

## Packages

- react: ^18.2.0
- react-dom: ^18.2.0
- react-router-dom: ^6.8.0
- @reduxjs/toolkit: ^1.9.0
- react-redux: ^8.0.0
- @mui/material: ^5.11.0
- axios: ^1.3.0
- socket.io-client: ^4.5.0

## Utilities

- formatCurrency - Format numbers as currency
- formatDate - Date formatting helper
- validateEmail - Email validation
- debounce - Debounce function calls

## Code Examples

### Functional Component

```jsx
function StatsCard({ title, value, change, icon }) {
  const formattedValue = useMemo(() => {
    return formatCurrency(value);
  }, [value]);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6">{title}</Typography>
        <Typography variant="h4">{formattedValue}</Typography>
        {icon}
      </CardContent>
    </Card>
  );
}
```

### Custom Hook Example

```jsx
function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const currentUser = await AuthService.getCurrentUser();
      setUser(currentUser);
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (credentials) => {
    const user = await AuthService.login(credentials);
    setUser(user);
  };

  return { user, login, loading };
}
```

### Redux Usage

```jsx
function RidesList() {
  const dispatch = useDispatch();
  const rides = useSelector(state => state.rides.list);
  const loading = useSelector(state => state.rides.loading);

  useEffect(() => {
    dispatch(fetchRides());
  }, [dispatch]);

  return <RidesTable rides={rides} loading={loading} />;
}
```

### Package Dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.0",
    "@reduxjs/toolkit": "^1.9.0",
    "react-redux": "^8.0.0",
    "@mui/material": "^5.11.0"
  }
}
```
