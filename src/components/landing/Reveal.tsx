"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * 스크롤에 들어오면 한 번 나타나는 래퍼.
 *
 * motion 의 `whileInView` + `viewport.once` 를 쓴다 — 위아래로 스크롤할 때
 * 요소가 다시 사라졌다 나타나며 깜빡이지 않는다.
 * `prefers-reduced-motion` 이면 애니메이션 없이 그대로 보인다.
 */
export default function Reveal({
  children,
  delay = 0,
  as = "div",
  className,
  ...rest
}: {
  children: React.ReactNode;
  delay?: number;
  as?: "div" | "section" | "li" | "article" | "figure";
  className?: string;
} & Omit<HTMLMotionProps<"div">, "children" | "className">) {
  const reduced = useReducedMotion();
  const Tag = motion[as] as typeof motion.div;

  if (reduced) {
    const Plain = as as "div";
    return <Plain className={className}>{children}</Plain>;
  }

  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: 26, filter: "blur(5px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.18, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.75, delay: delay / 1000, ease: EASE }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
