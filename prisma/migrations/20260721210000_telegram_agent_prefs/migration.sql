-- Per-farmer Telegram voice-agent preferences (set via bot /language and /mode menus)
ALTER TABLE "Farmer" ADD COLUMN "telegramLang" TEXT;
ALTER TABLE "Farmer" ADD COLUMN "telegramMode" TEXT;
