/**
 * Extracts initials from a user's name:
 * - "John Doe" -> "JD"
 * - "Jay K Shah" -> "JS" (first letter of first name and first letter of last name)
 * - "Jay" -> "JA" (fallback to first two letters of the first name)
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return "";
  const cleaned = name.trim();
  if (!cleaned) return "";
  
  const parts = cleaned.split(/\s+/);
  if (parts.length > 1) {
    const firstInitial = parts[0][0] || "";
    const lastInitial = parts[parts.length - 1][0] || "";
    return (firstInitial + lastInitial).toUpperCase();
  }
  
  return cleaned.substring(0, 2).toUpperCase();
}
