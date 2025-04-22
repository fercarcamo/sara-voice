// scripts/logging.js

export function logError(context, error) {
  console.error(`Error in ${context}:`, error);
}

export function logConversation(userInput, saraReply, conversationId) {
    const entries = [
      { role: "user", content: userInput },
      { role: "assistant", content: saraReply }
    ];
  
    entries.forEach(async ({ role, content }) => {
      try {
        await fetch("http://localhost:3001/api/logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role,
            content,
            timestamp: new Date().toISOString(), // ← ⏱ hier neu pro Eintrag!
            conversationId
          })
        });
      } catch (err) {
        console.error("Error in DB logConversation:", err);
      }
    });
  }

  export async function copyLastConversationToClipboard() {
    try {
      const res = await fetch("http://localhost:3001/api/logs");
      const allLogs = await res.json();
  
      // Gruppiere nach Konversation
      const sessions = allLogs.reduce((acc, log) => {
        if (!acc[log.conversationId]) acc[log.conversationId] = [];
        acc[log.conversationId].push(log);
        return acc;
      }, {});
  
      // Finde den neuesten conversationId basierend auf größtem Timestamp
      const latestConversationId = Object.keys(sessions).sort((a, b) => {
        const aNum = Number(a.replace("conv-", ""));
        const bNum = Number(b.replace("conv-", ""));
        return bNum - aNum;
      })[0];
  
      const latestLogs = sessions[latestConversationId].sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );
  
      await navigator.clipboard.writeText(JSON.stringify(latestLogs, null, 2));
      alert("📋 Letzte Konversation wurde in die Zwischenablage kopiert!");
    } catch (err) {
      console.error("Fehler beim Kopieren der Konversation:", err);
      alert("Fehler beim Kopieren.");
    }
  }