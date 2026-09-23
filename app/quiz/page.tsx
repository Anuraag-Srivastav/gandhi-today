import type { Metadata } from "next";
import { Quiz } from "@/components/Quiz";
export const metadata: Metadata = { title: "A short Gandhi quiz | Gandhi Says", description: "Five questions in Hindi, with fixed answers, explanations and historical sources. No AI-generated scoring." };
export default function QuizPage() { return <Quiz />; }
