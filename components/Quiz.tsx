"use client";

/** Deterministic quiz: local state only, no network or model calls. */
import { useRef, useState } from "react";
import { quizQuestions, scoreQuiz } from "@/lib/quiz";
import { SiteFrame } from "./SiteFrame";

export function Quiz() {
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>(() => quizQuestions.map(() => null));
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const complete = index === quizQuestions.length;
  const question = quizQuestions[index];
  const score = scoreQuiz(answers);
  function focus() { requestAnimationFrame(() => heading.current?.focus()); }
  function next() { setIndex(value => value + 1); setSelected(null); setRevealed(false); setError(""); focus(); }
  function check() {
    if (selected === null) { setError("एक विकल्प चुनें, या सवाल छोड़ दें।"); return; }
    setAnswers(previous => previous.map((answer, i) => i === index ? selected : answer)); setRevealed(true); setError("");
  }
  function restart() { setIndex(0); setSelected(null); setRevealed(false); setAnswers(quizQuestions.map(() => null)); setError(""); setStarted(true); focus(); }
  return <SiteFrame quiz><div lang="hi">
    <section className="site-hero quiz-intro"><span className="eyebrow">विचारों को परखें</span><h1>पाँच सवाल।<br /><em>थोड़ा आत्मचिंतन।</em></h1><p>गांधी के विचारों से परिचय का छोटा अभ्यास। हर जवाब के बाद व्याख्या और स्रोत पढ़ें। यह आपके चरित्र का मूल्यांकन नहीं है।</p></section>
    <section className="quiz-card paper-card" aria-label="गांधी विचार प्रश्नोत्तरी">
      {!started ? <><h2 ref={heading} tabIndex={-1}>लगभग 3 मिनट · 5 सवाल</h2><p className="my-5 leading-8">सही उत्तर पहले से तय हैं। यहां AI जवाब नहीं बनाता। आप कोई भी सवाल छोड़ सकते हैं। आज के उदाहरणों को ऐतिहासिक कथनों से अलग बताया गया है।</p><button className="primary-button" onClick={() => { setStarted(true); focus(); }}>शुरू करें →</button></> : complete ? <>
        <h2 ref={heading} tabIndex={-1} className="text-2xl">आपका अभ्यास पूरा हुआ</h2><p className="quiz-score">{score.correct} / {score.total}</p><p role="status">सही: {score.correct} · गलत: {score.incorrect} · छोड़े: {score.skipped}</p><p className="mt-4 leading-8">अंक से ज्यादा जरूरी है विचार और उसका संदर्भ समझना। नीचे सभी सवालों की व्याख्या है।</p>
        <ol className="quiz-review">{quizQuestions.map((item, i) => <li key={item.id}><h3>{i + 1}. {item.topic} — {answers[i] === null ? "छोड़ा" : answers[i] === item.correct ? "सही" : "फिर देखें"}</h3><p>{item.question}</p><p>सही विकल्प: {item.options[item.correct]}</p><p>{item.explanation}</p><p>{item.caveat}</p><a href={item.source.url} target="_blank" rel="noopener noreferrer">स्रोत: {item.source.title} ↗</a></li>)}</ol><button className="primary-button" onClick={restart}>फिर से शुरू करें</button>
      </> : <>
        <div className="quiz-progress"><h2 ref={heading} tabIndex={-1}>सवाल {index + 1} / {quizQuestions.length} · {question.topic}</h2><progress value={index + 1} max={quizQuestions.length} aria-label="प्रगति" /></div>
        <fieldset className="quiz-question" disabled={revealed}><legend>{question.question}</legend><div className="quiz-options">{question.options.map((option, i) => <label className="quiz-option" key={option}><input type="radio" name={question.id} value={i} checked={selected === i} onChange={() => { setSelected(i); setError(""); }} /><span>{option}</span></label>)}</div></fieldset>
        {error && <p role="alert" className="error-note">{error}</p>}
        {revealed && <div className="quiz-feedback" role="status"><h3>{selected === question.correct ? "सही समझा।" : "इसे इस तरह समझें।"}</h3>{selected !== question.correct && <p>सही विकल्प: {question.options[question.correct]}</p>}<p>{question.explanation}</p><p className="quiz-caveat">{question.caveat}</p><a href={question.source.url} target="_blank" rel="noopener noreferrer">स्रोत पढ़ें: {question.source.title} ↗</a></div>}
        <div className="quiz-actions">{revealed ? <button className="primary-button" onClick={next}>{index === quizQuestions.length - 1 ? "परिणाम देखें →" : "अगला सवाल →"}</button> : <><button className="primary-button" onClick={check}>जवाब देखें</button><button className="text-button" onClick={next}>यह सवाल छोड़ें</button></>}</div>
      </>}
    </section>
  </div></SiteFrame>;
}
