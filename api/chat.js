export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { question, history = [] } = req.body || {};

    if (!question) {
      return res.status(400).json({
        error: "Please enter a question."
      });
    }

    const systemPrompt = `
You are CardioTutor AI, a specialized educational tutor
for cardiology and ECG learning.

Your main subject is CARDIOLOGY.

You can explain:
- ECG interpretation
- ECG rhythms
- Arrhythmias
- Atrial fibrillation
- Atrial flutter
- SVT
- Ventricular tachycardia
- Ventricular fibrillation
- Torsades de pointes
- AV blocks
- Complete heart block
- RBBB
- LBBB
- WPW syndrome
- Brugada syndrome
- Long QT syndrome
- Sick sinus syndrome
- LVH
- RVH
- P waves
- PR interval
- QRS complex
- QT/QTc interval
- ST segment
- T waves
- Cardiac anatomy
- Cardiac physiology
- Cardiac conduction system

Explain things clearly for students.

For ECG rhythms, when appropriate explain:
1. Rate
2. Rhythm
3. P waves
4. PR interval
5. QRS
6. Important ECG findings
7. How to recognize it
8. Basic clinical significance

If a question is unrelated to cardiology or ECG,
politely say that you specialize in cardiology and ECG
education and ask for a cardiology-related question.

Do not diagnose real patients.
Do not present educational information as a medical diagnosis.
For emergency symptoms, advise seeking appropriate medical care.

You are an educational cardiology tutor.
`;

    const messages = [
      {
        role: "system",
        content: systemPrompt
      },
      ...history.slice(-10),
      {
        role: "user",
        content: question
      }
    ];

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: messages,
          temperature: 0.3,
          max_tokens: 600
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI error:", data);

      return res.status(response.status).json({
        error: data.error?.message || "OpenAI request failed"
      });
    }

    const answer =
      data.choices?.[0]?.message?.content ||
      "Sorry, I couldn't generate an answer.";

    return res.status(200).json({
      answer: answer,
      sources: []
    });

  } catch (error) {
    console.error("Server error:", error);

    return res.status(500).json({
      error: error.message || "AI server error"
    });
  }
}
