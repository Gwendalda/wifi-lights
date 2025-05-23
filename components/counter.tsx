/**
 * Counter component that displays a button with an incrementing count.
 * Demonstrates basic state management using React hooks.
 */
"use client";

import { useState } from "react";

/**
 * Renders a counter button that increments a number when clicked.
 * @returns {JSX.Element} A button displaying the current count
 */
export const Counter = () => {
  const [count, setCount] = useState(0);

  return (
    <button
      type="button"
      onClick={() => setCount(count + 1)}
      className="px-4 py-2 bg-primary text-primary-foreground font-medium rounded-full shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
    >
      Count is {count}
    </button>
  );
};
