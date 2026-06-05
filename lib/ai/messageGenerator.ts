import { OpenAI } from 'openai';

// EndpointAI OpenAI-compatible configuration instance
const openai = new OpenAI({
  apiKey: process.env.ENDPOINTAI_API_KEY?.trim(),
  baseURL: 'https://api.endpointai.in/v1',
});

export async function POST(req: Request) {
  try {
    const { customerName, productName, checkoutUrl } = await req.json();

    // AI Messaging generation prompt matrix
    const response = await openai.chat.completions.create({
      model: process.env.ENDPOINTAI_MODEL?.trim() || 'meta-llama-3-70b-instruct',
      messages: [
        {
          role: 'system',
          content: 'You are an advanced WhatsApp Cart Recovery AI. Craft high-converting, polite, and personalized recovery messages in Hinglish/English.',
        },
        {
          role: 'user',
          content: `Generate a personalized WhatsApp cart recovery message for customer "${customerName}" who left "${productName}" in their cart. Include this short checkout link: ${checkoutUrl}`,
        },
      ],
      temperature: 0.7,
    });

    const generatedMessage = response.choices[0]?.message?.content;
    return Response.json({ success: true, message: generatedMessage });
  } catch (error: any) {
    console.error('❌ EndpointAI Integration Exception:', error);
    return Response.json({ error: 'Failed to generate AI message framework.' }, { status: 500 });
  }
}
