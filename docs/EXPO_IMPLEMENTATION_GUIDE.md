# Expo Implementation Guide for Botie Reminder System

This guide explains how to implement the Botie reminder system in your Expo app for web, Android, and iOS.

## 🚀 Overview

The Botie reminder system supports:
- **Time-based reminders**: Trigger at specific dates/times
- **Location-based reminders**: Trigger when user is near a location
- **Hybrid reminders**: Both time and location triggers
- **Multiple notifications**: Email, phone calls, and real-time WebSocket notifications

## 📱 Required Expo Packages

```bash
expo install expo-location
expo install expo-notifications
expo install expo-background-fetch
expo install expo-task-manager
expo install @react-native-async-storage/async-storage
expo install expo-device
```

## 🔧 Setup

### 1. App Configuration

Add to your `app.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Allow Botie to use your location for location-based reminders.",
          "locationAlwaysPermission": "Allow Botie to use your location in the background for location-based reminders.",
          "locationWhenInUsePermission": "Allow Botie to use your location for location-based reminders."
        }
      ],
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#ffffff",
          "sounds": ["./assets/notification-sound.wav"]
        }
      ]
    ],
    "android": {
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "WAKE_LOCK",
        "RECEIVE_BOOT_COMPLETED"
      ]
    },
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": [
          "location",
          "background-processing"
        ]
      }
    }
  }
}
```

### 2. API Configuration

Create `config/api.js`:

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://your-backend-url.com/api';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async getAuthHeaders() {
    const token = await AsyncStorage.getItem('authToken');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  async request(endpoint, options = {}) {
    const headers = await this.getAuthHeaders();
    
    const config = {
      headers,
      ...options
    };

    if (options.body) {
      config.body = JSON.stringify(options.body);
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'API request failed');
    }

    return data;
  }

  // Reminder API methods
  async createReminder(reminderData) {
    return this.request('/reminders', {
      method: 'POST',
      body: reminderData
    });
  }

  async updateLocation(latitude, longitude) {
    return this.request('/reminders/location-update', {
      method: 'POST',
      body: { latitude, longitude }
    });
  }

  async getActiveReminders() {
    return this.request('/reminders/active');
  }

  async getReminders(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/reminders?${queryString}`);
  }
}

export default new ApiService();
```

## 📍 Location Service

Create `services/LocationService.js`:

```javascript
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import ApiService from '../config/api';

const LOCATION_TASK_NAME = 'background-location-task';

class LocationService {
  constructor() {
    this.isTracking = false;
    this.lastLocation = null;
    this.locationUpdateInterval = null;
  }

  // Request location permissions
  async requestPermissions() {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    
    if (foregroundStatus !== 'granted') {
      throw new Error('Location permission denied');
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    
    if (backgroundStatus !== 'granted') {
      console.warn('Background location permission denied');
    }

    return { foregroundStatus, backgroundStatus };
  }

  // Start location tracking
  async startLocationTracking() {
    if (this.isTracking) return;

    try {
      await this.requestPermissions();

      // Start foreground location updates
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 30000, // 30 seconds
        distanceInterval: 50, // 50 meters
        foregroundService: {
          notificationTitle: 'Botie Location Tracking',
          notificationBody: 'Tracking your location for reminders',
          notificationColor: '#667eea'
        }
      });

      this.isTracking = true;
      console.log('Location tracking started');
    } catch (error) {
      console.error('Error starting location tracking:', error);
      throw error;
    }
  }

  // Stop location tracking
  async stopLocationTracking() {
    if (!this.isTracking) return;

    try {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      this.isTracking = false;
      console.log('Location tracking stopped');
    } catch (error) {
      console.error('Error stopping location tracking:', error);
    }
  }

  // Get current location
  async getCurrentLocation() {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      this.lastLocation = location;
      return location;
    } catch (error) {
      console.error('Error getting current location:', error);
      throw error;
    }
  }

  // Send location update to backend
  async sendLocationUpdate(latitude, longitude) {
    try {
      await ApiService.updateLocation(latitude, longitude);
      console.log('Location update sent to backend');
    } catch (error) {
      console.error('Error sending location update:', error);
    }
  }
}

// Define background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Location task error:', error);
    return;
  }

  if (data) {
    const { locations } = data;
    const location = locations[0];

    if (location) {
      // Send location update to backend
      const locationService = new LocationService();
      await locationService.sendLocationUpdate(
        location.coords.latitude,
        location.coords.longitude
      );
    }
  }
});

export default LocationService;
```

## 🔔 Notification Service

Create `services/NotificationService.js`:

```javascript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

class NotificationService {
  constructor() {
    this.isInitialized = false;
  }

  // Initialize notifications
  async initialize() {
    if (this.isInitialized) return;

    // Configure notification behavior
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    // Request permissions
    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        throw new Error('Notification permission denied');
      }
    }

    this.isInitialized = true;
    console.log('Notifications initialized');
  }

  // Schedule local notification
  async scheduleNotification(reminder) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const trigger = this.createNotificationTrigger(reminder);
    
    if (!trigger) {
      console.log('No valid trigger for reminder:', reminder.id);
      return;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Botie Reminder',
          body: reminder.description,
          data: { reminderId: reminder.id },
          sound: 'default',
        },
        trigger,
      });

      console.log('Local notification scheduled for reminder:', reminder.id);
    } catch (error) {
      console.error('Error scheduling notification:', error);
    }
  }

  // Create notification trigger based on reminder type
  createNotificationTrigger(reminder) {
    if (reminder.reminderDateTime) {
      // Time-based reminder
      const triggerDate = new Date(reminder.reminderDateTime);
      
      // Don't schedule if the time has passed
      if (triggerDate <= new Date()) {
        return null;
      }

      return {
        date: triggerDate,
      };
    }

    // Location-based reminders are handled by the backend
    return null;
  }

  // Cancel notification
  async cancelNotification(reminderId) {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const notification = scheduledNotifications.find(n => 
        n.content.data?.reminderId === reminderId
      );

      if (notification) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        console.log('Notification cancelled for reminder:', reminderId);
      }
    } catch (error) {
      console.error('Error cancelling notification:', error);
    }
  }

  // Cancel all notifications
  async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('All notifications cancelled');
    } catch (error) {
      console.error('Error cancelling all notifications:', error);
    }
  }
}

export default new NotificationService();
```

## 🔌 WebSocket Service

Create `services/WebSocketService.js`:

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  // Connect to WebSocket
  async connect() {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userId = await AsyncStorage.getItem('userId');
      
      if (!token || !userId) {
        throw new Error('Authentication required');
      }

      const wsUrl = `wss://your-backend-url.com?token=${token}`;
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Join user room
        this.sendMessage('join-user-room', userId);
      };

      this.socket.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };

      this.socket.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnected = false;
        this.attemptReconnect();
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
    }
  }

  // Send message to WebSocket
  sendMessage(type, data) {
    if (this.socket && this.isConnected) {
      this.socket.send(JSON.stringify({ type, data }));
    }
  }

  // Handle incoming messages
  handleMessage(message) {
    switch (message.type) {
      case 'reminder_triggered':
        this.handleReminderTriggered(message.data);
        break;
      case 'notification':
        this.handleNotification(message.data);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  // Handle reminder triggered
  handleReminderTriggered(reminderData) {
    console.log('Reminder triggered:', reminderData);
    
    // Show local notification
    this.showLocalNotification(reminderData);
    
    // You can also update your app state here
    // For example, update the reminders list or show a modal
  }

  // Handle general notification
  handleNotification(notificationData) {
    console.log('Notification received:', notificationData);
    this.showLocalNotification(notificationData);
  }

  // Show local notification
  async showLocalNotification(data) {
    const { Notifications } = await import('expo-notifications');
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: data.title || 'Botie Notification',
        body: data.message || data.description,
        data: data,
      },
      trigger: null, // Show immediately
    });
  }

  // Attempt to reconnect
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect();
      }, delay);
    }
  }

  // Disconnect from WebSocket
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.isConnected = false;
    }
  }
}

export default new WebSocketService();
```

## 🎯 Reminder Manager

Create `services/ReminderManager.js`:

```javascript
import ApiService from '../config/api';
import NotificationService from './NotificationService';
import LocationService from './LocationService';
import WebSocketService from './WebSocketService';

class ReminderManager {
  constructor() {
    this.reminders = [];
    this.isInitialized = false;
  }

  // Initialize the reminder system
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Initialize services
      await NotificationService.initialize();
      await WebSocketService.connect();
      await LocationService.startLocationTracking();

      // Load active reminders
      await this.loadActiveReminders();

      this.isInitialized = true;
      console.log('Reminder system initialized');
    } catch (error) {
      console.error('Error initializing reminder system:', error);
      throw error;
    }
  }

  // Load active reminders from backend
  async loadActiveReminders() {
    try {
      const response = await ApiService.getActiveReminders();
      this.reminders = response.data.reminders;
      
      // Schedule local notifications for time-based reminders
      this.reminders.forEach(reminder => {
        if (reminder.reminderDateTime) {
          NotificationService.scheduleNotification(reminder);
        }
      });

      console.log(`Loaded ${this.reminders.length} active reminders`);
    } catch (error) {
      console.error('Error loading active reminders:', error);
    }
  }

  // Create a new reminder
  async createReminder(reminderData) {
    try {
      const response = await ApiService.createReminder(reminderData);
      const newReminder = response.data;

      // Add to local list
      this.reminders.push(newReminder);

      // Schedule local notification if time-based
      if (newReminder.reminderDateTime) {
        await NotificationService.scheduleNotification(newReminder);
      }

      console.log('Reminder created:', newReminder.id);
      return newReminder;
    } catch (error) {
      console.error('Error creating reminder:', error);
      throw error;
    }
  }

  // Update a reminder
  async updateReminder(reminderId, updateData) {
    try {
      const response = await ApiService.request(`/reminders/${reminderId}`, {
        method: 'PUT',
        body: updateData
      });

      const updatedReminder = response.data;

      // Update local list
      const index = this.reminders.findIndex(r => r.id === reminderId);
      if (index !== -1) {
        this.reminders[index] = updatedReminder;
      }

      // Reschedule notification if time changed
      if (updatedReminder.reminderDateTime) {
        await NotificationService.cancelNotification(reminderId);
        await NotificationService.scheduleNotification(updatedReminder);
      }

      console.log('Reminder updated:', reminderId);
      return updatedReminder;
    } catch (error) {
      console.error('Error updating reminder:', error);
      throw error;
    }
  }

  // Delete a reminder
  async deleteReminder(reminderId) {
    try {
      await ApiService.request(`/reminders/${reminderId}`, {
        method: 'DELETE'
      });

      // Remove from local list
      this.reminders = this.reminders.filter(r => r.id !== reminderId);

      // Cancel local notification
      await NotificationService.cancelNotification(reminderId);

      console.log('Reminder deleted:', reminderId);
    } catch (error) {
      console.error('Error deleting reminder:', error);
      throw error;
    }
  }

  // Get all reminders
  async getReminders(params = {}) {
    try {
      const response = await ApiService.getReminders(params);
      return response.data;
    } catch (error) {
      console.error('Error getting reminders:', error);
      throw error;
    }
  }

  // Get reminder by ID
  getReminderById(reminderId) {
    return this.reminders.find(r => r.id === reminderId);
  }

  // Cleanup
  async cleanup() {
    try {
      await LocationService.stopLocationTracking();
      WebSocketService.disconnect();
      await NotificationService.cancelAllNotifications();
      
      this.reminders = [];
      this.isInitialized = false;
      
      console.log('Reminder system cleaned up');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

export default new ReminderManager();
```

## 📱 React Component Example

Create `components/ReminderForm.js`:

```javascript
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import ReminderManager from '../services/ReminderManager';

const ReminderForm = ({ onReminderCreated }) => {
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [reminderDateTime, setReminderDateTime] = useState(null);
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [isTimeBased, setIsTimeBased] = useState(false);
  const [isLocationBased, setIsLocationBased] = useState(false);

  const handleSubmit = async () => {
    try {
      if (!description.trim()) {
        Alert.alert('Error', 'Please enter a description');
        return;
      }

      if (!isTimeBased && !isLocationBased) {
        Alert.alert('Error', 'Please select at least one trigger type');
        return;
      }

      if (isLocationBased && (!latitude || !longitude)) {
        Alert.alert('Error', 'Please enter location coordinates');
        return;
      }

      const reminderData = {
        description: description.trim(),
        locationName: locationName.trim() || null,
        coordinates: isLocationBased ? {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude)
        } : null,
        reminderDateTime: isTimeBased ? reminderDateTime?.toISOString() : null
      };

      const newReminder = await ReminderManager.createReminder(reminderData);
      
      Alert.alert('Success', 'Reminder created successfully!');
      
      // Reset form
      setDescription('');
      setLocationName('');
      setLatitude('');
      setLongitude('');
      setReminderDateTime(null);
      setIsTimeBased(false);
      setIsLocationBased(false);

      // Notify parent component
      if (onReminderCreated) {
        onReminderCreated(newReminder);
      }

    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to create reminder');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create New Reminder</Text>

      <TextInput
        style={styles.input}
        placeholder="Reminder description"
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <View style={styles.switchContainer}>
        <Text>Time-based reminder</Text>
        <Switch
          value={isTimeBased}
          onValueChange={setIsTimeBased}
        />
      </View>

      {isTimeBased && (
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowDateTimePicker(true)}
        >
          <Text>
            {reminderDateTime 
              ? reminderDateTime.toLocaleString()
              : 'Select date and time'
            }
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.switchContainer}>
        <Text>Location-based reminder</Text>
        <Switch
          value={isLocationBased}
          onValueChange={setIsLocationBased}
        />
      </View>

      {isLocationBased && (
        <View>
          <TextInput
            style={styles.input}
            placeholder="Location name (optional)"
            value={locationName}
            onChangeText={setLocationName}
          />
          <TextInput
            style={styles.input}
            placeholder="Latitude"
            value={latitude}
            onChangeText={setLatitude}
            keyboardType="numeric"
          />
          <TextInput
            style={styles.input}
            placeholder="Longitude"
            value={longitude}
            onChangeText={setLongitude}
            keyboardType="numeric"
          />
        </View>
      )}

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
        <Text style={styles.submitButtonText}>Create Reminder</Text>
      </TouchableOpacity>

      {showDateTimePicker && (
        <DateTimePicker
          value={reminderDateTime || new Date()}
          mode="datetime"
          onChange={(event, selectedDate) => {
            setShowDateTimePicker(false);
            if (selectedDate) {
              setReminderDateTime(selectedDate);
            }
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
  },
  submitButton: {
    backgroundColor: '#667eea',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ReminderForm;
```

## 🚀 Usage in App.js

```javascript
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import ReminderManager from './services/ReminderManager';
import ReminderForm from './components/ReminderForm';

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      await ReminderManager.initialize();
      setIsInitialized(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to initialize app: ' + error.message);
    }
  };

  const handleReminderCreated = (reminder) => {
    console.log('New reminder created:', reminder);
    // Update your UI here
  };

  if (!isInitialized) {
    return (
      <View style={styles.container}>
        <Text>Initializing...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Botie Reminders</Text>
      <ReminderForm onReminderCreated={handleReminderCreated} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
  },
});
```

## 🔧 Environment Variables

Create `.env`:

```env
EXPO_PUBLIC_API_URL=https://your-backend-url.com/api
EXPO_PUBLIC_WS_URL=wss://your-backend-url.com
```

## 📋 Testing Checklist

- [ ] Location permissions granted
- [ ] Notification permissions granted
- [ ] WebSocket connection established
- [ ] Time-based reminders trigger at correct time
- [ ] Location-based reminders trigger when near location
- [ ] Email notifications received
- [ ] Phone calls received (if Twilio configured)
- [ ] Real-time notifications work
- [ ] Background location tracking works
- [ ] App handles network disconnections gracefully

## 🐛 Troubleshooting

### Common Issues:

1. **Location not working**: Check permissions and ensure location services are enabled
2. **Notifications not showing**: Verify notification permissions and check device settings
3. **WebSocket connection failed**: Check network connectivity and authentication
4. **Background tasks not running**: Ensure proper app configuration and permissions

### Debug Tips:

- Use `console.log` to track service initialization
- Check device logs for permission errors
- Test on physical device (not simulator) for location features
- Verify backend is running and accessible

This implementation provides a complete reminder system for your Expo app with time-based, location-based, and hybrid reminders, along with multiple notification channels. 