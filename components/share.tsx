"use client";
import { useState } from "react";
export function Share() {
  const [message, setMessage] = useState("");
  async function share() {
    const text =
      "চাকরির আবেদন করতে আপনি কত টাকা ফি দিয়েছেন? “ফি দেই, কিন্তু চাকরি নাই”-এ বেনামে জানান।";
    try {
      if (navigator.share)
        await navigator.share({
          title: "ফি দেই, কিন্তু চাকরি নাই",
          text,
          url: location.origin,
        });
      else {
        await navigator.clipboard.writeText(`${text} ${location.origin}`);
        setMessage("লিংক কপি হয়েছে");
      }
    } catch {
      setMessage("শেয়ার করা যায়নি। ব্রাউজারের ঠিকানা কপি করুন।");
    }
  }
  return (
    <>
      <button className="button outline" onClick={share}>
        হিসাবটা ছড়িয়ে দিন
      </button>
      <span className="sample ml-3" role="status">
        {message}
      </span>
    </>
  );
}
