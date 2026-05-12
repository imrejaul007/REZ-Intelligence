/**
 * REZ Agent OS - React Chat Widget
 *
 * Single unified chat for customers
 * Handles both Agent OS (tasks) and Support Copilot (issues)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal
} from 'react-native';

const AGENT_OS_URL = 'http://localhost:4100'; // REZ-unified-chat server

export const AgentOSChatWidget = ({
  userId,
  namespace = 'general',
  apiKey,
  position = 'bottom-right',
  theme = 'dark'
}) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef();

  const styles = getStyles(theme);

  // Send message to Agent OS
  const sendMessage = async (text) => {
    if (!text.trim()) return;

    // Add user message
    const userMsg = { role: 'user', content: text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch(`${AGENT_OS_URL}/api/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          userId,
          message: text,
          namespace
        })
      });

      const data = await response.json();

      if (data.success) {
        const assistantMsg = {
          role: 'assistant',
          content: data.response.message,
          actions: data.response.actions,
          routing: data.response.routing,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, assistantMsg]);
      }
    } catch (error) {
      console.error('Agent OS error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I\'m having trouble. Please try again.',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  // Render message
  const renderMessage = (msg) => (
    <View key={msg.timestamp} style={[
      styles.message,
      msg.role === 'user' ? styles.userMessage : styles.assistantMessage
    ]}>
      <Text style={styles.messageText}>{msg.content}</Text>

      {msg.actions?.length > 0 && (
        <View style={styles.actions}>
          {msg.actions.map((action, i) => (
            <TouchableOpacity
              key={i}
              style={styles.actionButton}
              onPress={() => action.type === 'suggest' ? sendMessage(action.text) : null}
            >
              <Text style={styles.actionText}>{action.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {msg.routing && (
        <Text style={styles.routingTag}>
          {msg.routing.route === 'agent-os' ? '🤖 Agent OS' : '🎧 Support'}
      </Text>
      )}
    </View>
  );

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setIsOpen(true)}
        >
          <Text style={styles.fabIcon}>💬</Text>
        </TouchableOpacity>
      )}

      {/* Chat Modal */}
      <Modal
        visible={isOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Agent OS</Text>
            <TouchableOpacity onPress={() => setIsOpen(false)}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <ScrollView
            ref={scrollRef}
            style={styles.messages}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd()}
          >
            <View style={styles.welcome}>
              <Text style={styles.welcomeTitle}>
                Hi! I'm your REZ Assistant 👋
              </Text>
              <Text style={styles.welcomeText}>
                I can help you:
              </Text>
              <Text style={styles.welcomeItem}>• Book restaurants, hotels, activities</Text>
              <Text style={styles.welcomeItem}>• Order food & products</Text>
              <Text style={styles.welcomeItem}>• Track orders & bookings</Text>
              <Text style={styles.welcomeItem}>• Get help with issues</Text>
            </View>

            {messages.map(renderMessage)}

            {isTyping && (
              <View style={styles.typing}>
                <Text style={styles.typingText}>Agent OS is typing...</Text>
              </View>
            )}
          </ScrollView>

          {/* Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Ask me anything..."
              placeholderTextColor="#999"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => sendMessage(input)}
            />
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={() => sendMessage(input)}
            >
              <Text style={styles.sendBtnText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const getStyles = (theme) => ({
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  },
  fabIcon: { fontSize: 28 },
  container: {
    flex: 1,
    backgroundColor: theme === 'dark' ? '#1a1a2e' : '#fff'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff'
  },
  closeBtn: {
    fontSize: 20,
    color: '#999',
    padding: 8
  },
  messages: { flex: 1, padding: 16 },
  message: {
    marginVertical: 8,
    padding: 12,
    borderRadius: 12,
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
  messageText: { color: '#fff', fontSize: 16 },
  actions: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap' },
  actionButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginTop: 8
  },
  actionText: { color: '#fff', fontSize: 14 },
  routingTag: {
    fontSize: 10,
    color: '#666',
    marginTop: 4
  },
  welcome: {
    padding: 16,
    backgroundColor: 'rgba(0,122,255,0.1)',
    borderRadius: 12,
    marginBottom: 16
  },
  welcomeTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  welcomeText: { color: '#999', marginBottom: 8 },
  welcomeItem: { color: '#ccc', marginVertical: 2 },
  typing: {
    padding: 8,
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
    color: '#fff',
    marginRight: 8
  },
  sendBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    justifyContent: 'center'
  },
  sendBtnText: { color: '#fff', fontWeight: 'bold' }
});

export default AgentOSChatWidget;
