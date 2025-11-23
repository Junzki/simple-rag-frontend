import { useState } from "react";
import ReactMarkdown from "react-markdown";

export default function Chat() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setIsLoading(true);
    setAnswer("");

    try {
      // Assuming the server endpoint is /api/chat and accepts POST
      const response = await fetch("http://localhost:8000/api/v1/llm-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const text = decoder.decode(value, { stream: true });
        
        // If the server sends Server-Sent Events (SSE) format (e.g. "data: ..."),
        // you might need to parse it here. For now, we assume raw text or 
        // handle simple "data: " prefix removal if it's a standard SSE stream 
        // that sends just the text content in data.
        
        // Simple SSE parsing logic (optional, depends on server implementation)
        const lines = text.split('\n');
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                // Check for [DONE] or similar end markers if used
                if (data.trim() !== '[DONE]') {
                     setAnswer((prev) => prev + data);
                }
            } else if (line.trim() !== '') {
                // Fallback for raw text or other formats
                setAnswer((prev) => prev + line);
            }
        }
      }
    } catch (error) {
      console.error("Error:", error);
      setAnswer("Error occurred while fetching response.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">RAG Chat</h1>
      
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex flex-col gap-4">
          <label htmlFor="question" className="text-lg font-medium text-gray-700">
            Your Question
          </label>
          <textarea
            id="question"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask something..."
            rows={4}
          />
          <button
            type="submit"
            className="self-end bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed font-medium"
            disabled={isLoading || !question.trim()}
          >
            {isLoading ? "Thinking..." : "Send Question"}
          </button>
        </div>
      </form>

      {answer && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Response:</h2>
          <div className="prose prose-blue max-w-none">
            <ReactMarkdown>{answer}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
