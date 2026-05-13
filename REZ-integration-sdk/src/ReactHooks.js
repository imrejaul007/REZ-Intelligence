/**
 * REZ Agent OS - React Native Hooks
 *
 * Use in any React Native app:
 *
 * import { useAgentOS } from './ReactHooks';
 *
 * const MyComponent = () => {
 *   const { chat, isTyping, messages, recommend } = useAgentOS({
 *     appId: 'my-app',
 *     userId: 'user123'
 *   });
 *
 *   return <ChatWidget messages={messages} onSend={chat} />;
 * };
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

// =========================================================================
// CONTEXT
// =========================================================================

const AgentOSContext = React.createContext(null);

// =========================================================================
// PROVIDER
// =========================================================================

export const AgentOSProvider = ({ children, config }) => {
  const [client] = useState(() => new AgentOSClient(config));
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (config.userId) {
      client.connect(config.userId)
        .then(() => setIsConnected(true))
        .catch(console.error);
    }

    return () => client.disconnect();
  }, [config.userId]);

  const value = {
    client,
    isConnected,
    messages,
    setMessages,
    isTyping
  };

  return (
    <AgentOSContext.Provider value={value}>
      {children}
    </AgentOSContext.Provider>
  );
};

// =========================================================================
// HOOKS
// =========================================================================

/**
 * Main Agent OS hook
 */
export const useAgentOS = (config = {}) => {
  const context = React.useContext(AgentOSContext);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const clientRef = useRef(null);

  useEffect(() => {
    clientRef.current = new AgentOSClient({
      ...config,
      onMessage: (msg) => setMessages(prev => [...prev, msg]),
      onTyping: (typing) => setIsTyping(typing)
    });

    if (config.userId) {
      clientRef.current.connect(config.userId).catch(console.error);
    }

    return () => clientRef.current?.disconnect();
  }, []);

  /**
   * Send message
   */
  const chat = useCallback(async (message, context = {}) => {
    setIsLoading(true);
    setIsTyping(true);

    // Add user message
    setMessages(prev => [...prev, {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    }]);

    try {
      const response = await clientRef.current.chat(message, context);

      // Add assistant message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.response,
        routing: response.routing,
        timestamp: new Date().toISOString()
      }]);

      return response;
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  }, []);

  /**
   * Get recommendations
   */
  const recommend = useCallback(async (options = {}) => {
    return await clientRef.current?.recommend(options) || { recommendations: [] };
  }, []);

  /**
   * Track event
   */
  const track = useCallback((eventType, properties = {}) => {
    clientRef.current?.track(eventType, properties);
  }, []);

  /**
   * Get user context
   */
  const getContext = useCallback(async () => {
    return await clientRef.current?.getUserContext();
  }, []);

  /**
   * Clear messages
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    chat,
    messages,
    setMessages,
    isTyping,
    isLoading,
    recommend,
    track,
    getContext,
    clearMessages
  };
};

// =========================================================================
// DO APP HOOK
// =========================================================================

export const useDOApp = (config = {}) => {
  const { chat, track, recommend, ...rest } = useAgentOS({
    appId: 'do-app',
    namespace: 'do-service',
    ...config
  });

  const trackBooking = useCallback((booking) => {
    track('do_booking', booking);
  }, [track]);

  const getRecommendations = useCallback(async (location) => {
    return await recommend({ type: 'do-service', location });
  }, [recommend]);

  return {
    chat,
    trackBooking,
    getRecommendations,
    track,
    ...rest
  };
};

// =========================================================================
// HOTEL OTA HOOK
// =========================================================================

export const useHotelOTA = (config = {}) => {
  const { chat, track, recommend, ...rest } = useAgentOS({
    appId: 'hotel-ota',
    namespace: 'hotel',
    ...config
  });

  const trackBooking = useCallback((booking) => {
    track('hotel_booking', booking);
  }, [track]);

  const trackSearch = useCallback((search) => {
    track('hotel_search', search);
  }, [track]);

  const getRecommendations = useCallback(async (location, dates) => {
    return await recommend({ type: 'hotel', location, ...dates });
  }, [recommend]);

  return {
    chat,
    trackBooking,
    trackSearch,
    getRecommendations,
    track,
    ...rest
  };
};

// =========================================================================
// ADBAZAAR HOOK
// =========================================================================

export const useAdBazaar = (config = {}) => {
  const { track, ...rest } = useAgentOS({
    appId: 'adbazaar',
    namespace: 'advertising',
    ...config
  });

  const trackImpression = useCallback((adId, campaignId) => {
    track('ad_impression', { adId, campaignId });
  }, [track]);

  const trackClick = useCallback((adId, campaignId) => {
    track('ad_click', { adId, campaignId });
  }, [track]);

  const trackConversion = useCallback((adId, orderId, value) => {
    track('ad_conversion', { adId, orderId, value });
  }, [track]);

  return {
    trackImpression,
    trackClick,
    trackConversion,
    track,
    ...rest
  };
};

// =========================================================================
// RENDEZ HOOK
// =========================================================================

export const useRendez = (config = {}) => {
  const { track, recommend, ...rest } = useAgentOS({
    appId: 'rendez',
    namespace: 'dating',
    ...config
  });

  const trackProfileView = useCallback((profileId) => {
    track('profile_view', { profileId });
  }, [track]);

  const trackMatch = useCallback((matchId, profileId) => {
    track('match', { matchId, profileId });
  }, [track]);

  const trackMessage = useCallback((conversationId) => {
    track('message_sent', { conversationId });
  }, [track]);

  const getRecommendations = useCallback(async () => {
    return await recommend({ type: 'dating' });
  }, [recommend]);

  return {
    trackProfileView,
    trackMatch,
    trackMessage,
    getRecommendations,
    track,
    ...rest
  };
};

// =========================================================================
// MERCHANT HOOK
// =========================================================================

export const useMerchant = (config = {}) => {
  const { track, recommend, getContext, ...rest } = useAgentOS({
    appId: 'merchant-app',
    namespace: 'merchant',
    ...config
  });

  const trackSale = useCallback((sale) => {
    track('merchant_sale', sale);
  }, [track]);

  const getInsights = useCallback(async (merchantId) => {
    return await recommend({ type: 'merchant', merchantId });
  }, [recommend]);

  return {
    trackSale,
    getInsights,
    getContext,
    track,
    ...rest
  };
};

// =========================================================================
// CHAT WIDGET COMPONENT
// =========================================================================

export const AgentOSChatWidget = ({
  messages,
  onSend,
  isTyping,
  theme = 'dark'
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = React.useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (input.trim()) {
      onSend(input);
      setInput('');
    }
  };

  const styles = getStyles(theme);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Agent OS</Text>
      </View>

      <ScrollView style={styles.messages}>
        {messages.map((msg, i) => (
          <View
            key={i}
            style={[
              styles.message,
              msg.role === 'user' ? styles.userMessage : styles.assistantMessage
            ]}
          >
            <Text style={styles.messageText}>{msg.content}</Text>
            {msg.routing && (
              <Text style={styles.routingTag}>
                {msg.routing.route === 'agent-os' ? 'Agent' : 'Support'}
              </Text>
            )}
          </View>
        ))}

        {isTyping && (
          <View style={styles.typingIndicator}>
            <Text style={styles.typingText}>Agent OS is typing...</Text>
          </View>
        )}

        <View ref={messagesEndRef} />
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Ask me anything..."
          placeholderTextColor="#999"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// =========================================================================
// STYLES
// =========================================================================

const getStyles = (theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme === 'dark' ? '#1a1a2e' : '#fff'
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff'
  },
  messages: {
    flex: 1,
    padding: 16
  },
  message: {
    padding: 12,
    borderRadius: 12,
    marginVertical: 4,
    maxWidth: '80%'
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF'
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#2a2a3e'
  },
  messageText: {
    color: '#fff',
    fontSize: 16
  },
  routingTag: {
    fontSize: 10,
    color: '#666',
    marginTop: 4
  },
  typingIndicator: {
    padding: 8
  },
  typingText: {
    color: '#666',
    fontStyle: 'italic'
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333'
  },
  input: {
    flex: 1,
    backgroundColor: '#2a2a3e',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff'
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    justifyContent: 'center',
    marginLeft: 8
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold'
  }
});

// Import these from react-native
const { View, Text, TextInput, ScrollView, TouchableOpacity } = require('react-native');
