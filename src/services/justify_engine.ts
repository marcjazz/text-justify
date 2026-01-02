/**
 * Justifies the given text to a maximum line length.
 * 
 * Rules:
 * - All lines except the last must be exactly maxLength.
 * - Words are not broken.
 * - Last line is left-aligned.
 * - Extra spaces are distributed evenly between words.
 * 
 * @param text The input text to justify.
 * @param maxLength The maximum length of each line.
 * @returns An array of justified strings.
 */
export function justifyText(text: string, maxLength: number): string[] {
  if (maxLength <= 0) {
    throw new Error("Line length must be greater than zero.");
  }

  // 1. Normalize and Tokenize
  const words = text.trim().split(/\s+/).filter(word => word.length > 0);

  if (words.length === 0) {
    return [];
  }

  const lines: string[][] = [];
  let currentLine: string[] = [];
  let currentLength = 0;

  // 2. Group words into lines greedily
  for (const word of words) {
    // If word is longer than maxLength, it will be on its own line (or break the rule)
    // According to requirements "Words should not be broken", we'll put it on its own line.
    
    const spaceNeeded = currentLine.length > 0 ? 1 : 0;
    
    if (currentLength + spaceNeeded + word.length <= maxLength || currentLine.length === 0) {
      currentLine.push(word);
      currentLength += spaceNeeded + word.length;
    } else {
      lines.push(currentLine);
      currentLine = [word];
      currentLength = word.length;
    }
  }
  lines.push(currentLine); // Push the last line

  // 3. Justify lines
  return lines.map((line, index) => {
    const isLastLine = index === lines.length - 1;
    const wordCount = line.length;

    // Last line or single word line: Left-aligned
    if (isLastLine || wordCount === 1) {
      const result = line.join(" ");
      return result.padEnd(maxLength, " ");
    }

    // Normal line justification
    const totalWordsLength = line.reduce((sum, word) => sum + word.length, 0);
    const totalSpaces = maxLength - totalWordsLength;
    const gapCount = wordCount - 1;
    
    const spacesPerGap = Math.floor(totalSpaces / gapCount);
    const extraSpaces = totalSpaces % gapCount;

    let justifiedLine = "";
    for (let i = 0; i < wordCount; i++) {
      justifiedLine += line[i];
      if (i < gapCount) {
        // Add base spaces + one extra space for the first 'extraSpaces' gaps
        const spacesToAdd = spacesPerGap + (i < extraSpaces ? 1 : 0);
        justifiedLine += " ".repeat(spacesToAdd);
      }
    }
    
    return justifiedLine;
  });
}
