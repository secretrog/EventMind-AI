function parseIssueReport(rawText) {
  const issueMarker = 'ISSUE_REPORT::';
  const markerIdx = rawText.indexOf(issueMarker);

  let visibleText = rawText;
  let issueData = undefined;

  if (markerIdx !== -1) {
    visibleText = rawText.slice(0, markerIdx).trim();
    let jsonStr = rawText.slice(markerIdx + issueMarker.length).trim();
    jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    try {
      issueData = JSON.parse(jsonStr);
    } catch (e) {
      console.warn('Failed to parse ISSUE_REPORT block:', jsonStr);
    }
  }
  return { response: visibleText, issueData };
}

const mockGeminiOutput1 = `Thank you for your feedback
ISSUE_REPORT::
\`\`\`json
{
  "title": "Wifi Issue",
  "category": "wifi",
  "location": "Unknown"
}
\`\`\`
`;

console.log(parseIssueReport(mockGeminiOutput1));
