/**
 * Voice Module - Add to Support Copilot
 *
 * Add this to REZ-support-copilot/src/index.js
 */

// Voice module imports
const voiceModule = require('./voice');
const { twilioWebhook, dailyWebhook, orchestrator } = voiceModule;

// Add voice routes
app.use('/webhook/voice/twilio', twilioWebhook);
app.use('/webhook/voice/daily', dailyWebhook);

// Voice API routes
app.post('/api/voice/process', async (req, res) => {
  try {
    const { audio, text, context } = req.body;

    let transcript = text;

    // If audio provided, transcribe first
    if (audio && !text) {
      const sttResult = await voiceModule.stt.transcribe(audio);
      transcript = sttResult.text;
    }

    // Route through AI
    const result = await orchestrator.route(
      { text: transcript },
      context
    );

    // Generate audio response if requested
    if (req.headers.accept?.includes('audio')) {
      const audioResponse = await voiceModule.tts.synthesize(result.message);
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': 'inline; filename="response.mp3"'
      });
      res.send(audioResponse.audio);
    } else {
      res.json(result);
    }
  } catch (error) {
    console.error('[Voice API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Voice health check
app.get('/health/voice', async (req, res) => {
  const status = orchestrator.getStatus();
  res.json({
    service: 'REZ Support Copilot - Voice AI',
    version: '1.0.0',
    status: 'ready',
    capabilities: ['text', 'voice', 'video'],
    agents: Object.keys(status.agents),
    ...status
  });
});
