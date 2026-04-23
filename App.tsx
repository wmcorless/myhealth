import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import { HealthProvider } from './src/context/HealthContext';
import { PreferencesProvider } from './src/context/PreferencesContext';
import { WatchHRProvider } from './src/context/WatchHRContext';
import { TreadmillProvider } from './src/context/TreadmillContext';
import ErrorBoundary from './src/components/ErrorBoundary';
import DashboardScreen from './src/screens/DashboardScreen';
import HeartRateScreen from './src/screens/HeartRateScreen';
import WorkoutsScreen from './src/screens/WorkoutsScreen';
import DevicesScreen from './src/screens/DevicesScreen';
import PreferencesScreen from './src/screens/PreferencesScreen';
import TreadmillScreen from './src/screens/TreadmillScreen';

const Tab = createBottomTabNavigator();

function TabIcon({ icon }: { icon: string }) {
  return <Text style={{ fontSize: 20 }}>{icon}</Text>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <PreferencesProvider>
        <HealthProvider>
          <WatchHRProvider>
            <TreadmillProvider>
            <NavigationContainer>
              <StatusBar style="dark" />
              <Tab.Navigator
                screenOptions={{
                  headerStyle: { backgroundColor: '#fff' },
                  headerTitleStyle: { fontWeight: '700', color: '#111' },
                  tabBarActiveTintColor: '#E53935',
                  tabBarInactiveTintColor: '#aaa',
                  tabBarStyle: { paddingBottom: 4 },
                }}
              >
                <Tab.Screen
                  name="Dashboard"
                  component={DashboardScreen}
                  options={{ tabBarIcon: () => <TabIcon icon="🏠" />, headerShown: false }}
                />
                <Tab.Screen
                  name="Heart Rate"
                  component={HeartRateScreen}
                  options={{ tabBarIcon: () => <TabIcon icon="❤️" /> }}
                />
                <Tab.Screen
                  name="Workouts"
                  component={WorkoutsScreen}
                  options={{ tabBarIcon: () => <TabIcon icon="📊" /> }}
                />
                <Tab.Screen
                  name="Devices"
                  component={DevicesScreen}
                  options={{ tabBarIcon: () => <TabIcon icon="📱" /> }}
                />
                <Tab.Screen
                  name="Treadmill"
                  component={TreadmillScreen}
                  options={{ tabBarIcon: () => <TabIcon icon="🏃" /> }}
                />
                <Tab.Screen
                  name="Preferences"
                  component={PreferencesScreen}
                  options={{ tabBarIcon: () => <TabIcon icon="⚙️" /> }}
                />
              </Tab.Navigator>
            </NavigationContainer>
            </TreadmillProvider>
          </WatchHRProvider>
          </HealthProvider>
      </PreferencesProvider>
    </ErrorBoundary>
  );
}
