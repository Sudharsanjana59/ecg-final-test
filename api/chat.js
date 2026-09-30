export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { question, history = [] } = req.body || {};

    if (!question || typeof question !== "string") {
      return res.status(400).json({
        error: "Question is required"
      });
    }

    const recentHistory = Array.isArray(history)
      ? history.slice(-10)
      : [];

    const conversation = recentHistory
      .map((msg) => {
        const role =
          msg.role === "assistant" ? "Tutor" : "Student";

        return `${role}: ${msg.content}`;
      })
      .join("\n");

    const prompt = `
You are CardioTutor AI inside the ECG Pulse Match educational game.

You are an ECG and cardiology tutor.

Focus on:
- ECG interpretation
- Normal sinus rhythm
- Atrial flutter
- Atrial fibrillation
- Ventricular tachycardia
- Ventricular fibrillation
- Torsades de pointes
- AV blocks
- Complete heart block
- RBBB
- LBBB
- Brugada syndrome
- Long QT syndrome
- WPW syndrome
- Sick sinus syndrome
- LVH
- RVH
- P waves
- PR interval
- QRS complex
- QT/QTc interval
- ST segment
- T waves
- Cardiac conduction
- Basic cardiology

Explain concepts in simple language suitable for students.

When explaining an ECG rhythm, include relevant features such as:
1. Heart rate
2. Rhythm regularity
3. P waves
4. PR interval
5. QRS width
6. QT/QTc
7. Characteristic ECG appearance
8. How to recognize it
9. Basic clinical significance

Do not diagnose real patients.
This is an educational tutor, not a medical diagnostic service.

If the question is unrelated to ECG or cardiology,
politely explain that you are focused on ECG and cardiology education.

Previous conversation:
${conversation}

Student's question:
${question}
`;

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured in Vercel."
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            maxOutputTokens: 600
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", data);

      return res.status(response.status).json({
        error:
          data.error?.message ||
          "Gemini API request failed"
      });
    }

    const answer =
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim();

    if (!answer) {
      return res.status(500).json({
        error: "No answer returned by Gemini."
      });
    }

    return res.status(200).json({
      answer,
      sources: []
    });

  } catch (error) {
    console.error("Server error:", error);

    return res.status(500).json({
      error: error.message || "AI server error"
    });
  }
}
