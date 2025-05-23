"use client";

import { useState } from "react";
// import { Button } from "@heroui/button"; // Removed

export const Counter = () => {
  const [count, setCount] = useState(0);

  return (
    <button // Replaced Button with HTML button
      type="button"
      onClick={() => setCount(count + 1)} // Changed onPress to onClick
      className="px-4 py-2 bg-primary text-primary-foreground font-medium rounded-full shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
      // The "radius='full'" prop is now handled by "rounded-full"
    >
      Count is {count}
    </button>
  );
};
