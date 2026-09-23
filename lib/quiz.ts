/** Curated learning exercise, never sent to the model. Explanations paraphrase the linked source sections. */
export type QuizQuestion = { id: string; topic: string; question: string; options: string[]; correct: number; explanation: string; caveat: string; source: { title: string; url: string } };
const wealth = { title: "Selections from Gandhi — The Distribution of Wealth", url: "https://www.mkgandhi.org/sfgbook/sixth.php" };
export const quizQuestions: QuizQuestion[] = [
  { id: "trusteeship", topic: "धन और जिम्मेदारी", question: "गांधी के ट्रस्टीशिप के विचार में जरूरत से अधिक धन रखने वाले व्यक्ति की जिम्मेदारी क्या है?", options: ["धन केवल अपनी इच्छाओं पर खर्च करना", "अपनी जरूरतें पूरी करके शेष धन समाज के हित में संभालना", "धन के उपयोग का समाज से कोई संबंध न मानना"], correct: 1,
    explanation: "ट्रस्टीशिप में अतिरिक्त संपत्ति समाज के लिए जिम्मेदारी है, केवल निजी उपभोग का अधिकार नहीं। स्रोत के खंड 276 में यह विचार समझाया गया है।", caveat: "यह एक ऐतिहासिक विचार की व्याख्या है, व्यक्तिगत वित्तीय सलाह नहीं।", source: wealth },
  { id: "technology", topic: "तकनीक और काम", question: "नई तकनीक से काम तेज होता है, लेकिन लोगों की रोजी चली जाती है। गांधी के मशीनों पर विचारों से कौन-सा सवाल निकलता है?", options: ["क्या हर मशीन को रोक देना चाहिए?", "क्या तेज उत्पादन अपने-आप सबका भला करता है?", "काम खोने वालों की आजीविका और तकनीक के लाभ का क्या होगा?"], correct: 2,
    explanation: "गांधी ने मशीनों का हर रूप नहीं ठुकराया। उन्होंने उस मशीनीकरण पर आपत्ति की जो लोगों को बिना दूसरे काम के बेरोजगार छोड़ देता है।", caveat: "आज की तकनीक पर यह प्रयोग हमारी व्याख्या है; गांधी की AI पर दर्ज राय नहीं।", source: { title: "The Voice of Truth — The place of machinery", url: "https://www.mkgandhi.org/voiceoftruth/machinery.php" } },
  { id: "khadi", topic: "खादी और आजीविका", question: "गांधी ने कताई और खादी को गांवों से क्यों जोड़ा?", options: ["गांव के लोगों को पूरक काम और आमदनी देने के लिए", "सिर्फ एक जैसे कपड़े पहनाने के लिए", "कपड़ों को केवल महंगा बनाने के लिए"], correct: 0,
    explanation: "उनके पत्रों में कताई और बुनाई को ग्रामीण परिवारों की आमदनी बढ़ाने से जोड़ा गया है। खादी केवल पहनावे की पसंद नहीं थी।", caveat: "यह औपनिवेशिक भारत के संदर्भ का विचार है; हर आधुनिक कपड़े पर तैयार फैसला नहीं।", source: { title: "Selected Letters — Khadi and Village Industry", url: "https://www.mkgandhi.org/selectedletters/08khadi_and_village_industry.php" } },
  { id: "consumption", topic: "जरूरत और दिखावा", question: "सोशल मीडिया देखकर बार-बार गैरजरूरी चीजें खरीदने की इच्छा होती है। अपरिग्रह का विचार कौन-सा सवाल उठाता है?", options: ["क्या दूसरों से ज्यादा चीजें रखना जरूरी है?", "क्या मुझे इसकी जरूरत है, या मैं केवल जमा कर रहा हूं?", "क्या महंगी चीज होना ही उपयोगिता का प्रमाण है?"], correct: 1,
    explanation: "अपरिग्रह जरूरत से अधिक संग्रह पर प्रश्न उठाता है। स्रोत के खंड 271 में अतिरिक्त संग्रह और दूसरों की कमी का संबंध बताया गया है।", caveat: "सोशल मीडिया पर यह आधुनिक अनुप्रयोग है, गांधी का कथन नहीं।", source: wealth },
  { id: "resources", topic: "संसाधन और साझेदारी", question: "सीमित संसाधनों के बंटवारे में गांधी की जरूरत-केंद्रित सोच के सबसे करीब कौन-सा विचार है?", options: ["जिसके पास ज्यादा पैसा है, उसकी हर इच्छा पहले पूरी हो", "जरूरतें अलग होने पर भी सबको बिल्कुल एक-सी मात्रा मिले", "हर व्यक्ति की आवश्यक जरूरत पूरी करने को प्राथमिकता मिले"], correct: 2,
    explanation: "खंड 277 में आर्थिक समानता का अर्थ सबके पास बिल्कुल समान मात्रा नहीं, बल्कि जरूरतों के लिए पर्याप्त साधन होना बताया गया है।", caveat: "इसे आज के संसाधन-संकट पर लागू करना व्याख्या है, गांधी की कोई तैयार आधुनिक नीति नहीं।", source: wealth },
];

/** Null answers are explicit skips; every question is counted exactly once. */
export function scoreQuiz(answers: (number | null)[], questions = quizQuestions) {
  const correct = questions.filter((question, index) => answers[index] === question.correct).length;
  const skipped = questions.filter((_, index) => answers[index] == null).length;
  return { correct, skipped, incorrect: questions.length - correct - skipped, total: questions.length };
}
