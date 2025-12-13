---
title: Flutter User App Documentation
description: Flutter documentation for TukTuk user mobile app
platform: mobile
flutterVersion: 3.16.0
---

# Flutter User App Documentation

This document describes the Flutter implementation for the TukTuk user mobile application.

## State Management

The app uses **Provider** pattern for state management, with ChangeNotifier classes for managing application state.

For navigation, we use **GoRouter** for type-safe routing with deep linking support.

## Screens

### Home Screen

The main landing screen showing nearby drivers and ride options.

**Type:** StatefulWidget
**Route:** /home

**Widgets:**
- MapWidget - Displays interactive map
- DriverListWidget - Shows available drivers
- RideRequestButton - Initiates ride request

**State Management:** Provider
**Dependencies:** LocationService, RideService

### Ride Booking Screen

Screen for booking a new ride with pickup and destination selection.

**Type:** StatefulWidget
**Route:** /ride/book

**Widgets:**
- LocationPicker
- FareEstimator
- ConfirmButton

### Profile Screen (Stateless)

User profile and settings screen.

**Route:** /profile

## Widgets

### MapWidget (Stateful)

Custom widget for displaying Google Maps with driver markers.

**Properties:**
- initialPosition: LatLng
- markers: List<Marker>
- onLocationChanged: Function

**Methods:**
- updateDriverLocations()
- centerOnUser()

### DriverCard (Stateless)

Card widget displaying driver information.

**Properties:**
- driver: Driver model
- onTap: VoidCallback

## Models

### User Model

Represents user data structure.

**Fields:**
- id: String
- name: String
- email: String
- phone: String
- photoUrl: String?
- createdAt: DateTime

### Ride Model

Represents ride request and details.

**Fields:**
- id: String
- userId: String
- driverId: String?
- pickupLocation: Location
- dropoffLocation: Location
- status: RideStatus
- fare: double
- createdAt: DateTime

## Services

### LocationService

Handles GPS and location tracking functionality.

**Type:** Location
**Methods:**
- getCurrentLocation()
- watchPosition()
- calculateDistance()

**Dependencies:** geolocator package

### RideService (API)

Manages ride requests and communication with backend API.

**Type:** API
**Methods:**
- createRide()
- getRideStatus()
- cancelRide()
- updateLocation()

### AuthService (Authentication)

Handles user authentication and session management.

**Methods:**
- login()
- logout()
- refreshToken()
- validateSession()

## Routes

- /home - HomeScreen
- /ride/book - RideBookingScreen
- /ride/active - ActiveRideScreen
- /profile - ProfileScreen
- /settings - SettingsScreen

## Packages

- provider: ^6.0.0
- go_router: ^12.0.0
- google_maps_flutter: ^2.5.0
- geolocator: ^10.0.0
- http: ^1.1.0
- shared_preferences: ^2.2.0

## Platform Features

- GPS and location services
- Push notifications via Firebase Cloud Messaging
- Background location tracking
- Deep linking support
- Platform-specific UI adaptations

## API Integration

The app integrates with the TukTuk backend API using HTTP REST calls. WebSocket connections are established for real-time driver location updates.

```dart
class RideService {
  final http.Client client;

  Future<Ride> createRide(RideRequest request) async {
    final response = await client.post(
      Uri.parse('$baseUrl/rides'),
      body: jsonEncode(request.toJson()),
    );
    return Ride.fromJson(jsonDecode(response.body));
  }
}
```

## Code Examples

### Stateless Widget Example

```dart
class DriverCard extends StatelessWidget {
  final Driver driver;
  final VoidCallback onTap;

  const DriverCard({
    required this.driver,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text(driver.name),
        subtitle: Text(driver.vehicle),
        onTap: onTap,
      ),
    );
  }
}
```

### Provider Usage

```dart
class HomeScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => RideProvider(),
      child: Consumer<RideProvider>(
        builder: (context, provider, child) {
          return Scaffold(
            body: RideList(rides: provider.rides),
          );
        },
      ),
    );
  }
}
```

### Pubspec Dependencies

```yaml
dependencies:
  flutter:
    sdk: flutter
  provider: ^6.0.0
  go_router: ^12.0.0
  google_maps_flutter: ^2.5.0
  geolocator: ^10.0.0
  http: ^1.1.0
  dio: ^5.0.0
```
