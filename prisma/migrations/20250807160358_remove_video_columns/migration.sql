/*
  Warnings:

  - You are about to drop the column `videoData` on the `Fragment` table. All the data in the column will be lost.
  - You are about to drop the column `videoMimeType` on the `Fragment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Fragment" DROP COLUMN "videoData",
DROP COLUMN "videoMimeType";
