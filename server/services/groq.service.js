import axios from "axios";

export const askAi = async (messages, isJson = true) => {

  try {

    let finalMessages = messages;
    if (isJson) {
      finalMessages = [
        {
          role: "system",
          content: `
Return ONLY valid JSON.

Rules:
- Use double quotes only
- No markdown
- No explanation
- No extra text
- Output must be parsable by JSON.parse()
`
        },
        ...messages
      ];
    }

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: finalMessages,

        temperature: 0,
        max_tokens: 300,
      },

      {
        headers: {
          Authorization: `Bearer ${process.env.groq_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    let content =
      response?.data?.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("AI returned empty response");
    }

    content = content.trim();

   
    content = content
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    return content;

  } catch (error) {

    console.log(
      "Groq Error:",
      error.response?.data || error.message
    );

    throw error;
  }
};