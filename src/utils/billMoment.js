const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const two = (n) => String(n).padStart(2, "0");

/**
 * When the guest was served, as it goes on the bill.
 *
 * An order keeps its date as plain text — "2026-09-22 11:30:00" — written in
 * the restaurant's own clock. There is no timezone on it because there does
 * not need to be: a restaurant is in one place.
 *
 * Handing that to a browser is where it goes wrong. Some read it as local
 * time, some as UTC, and the same bill then prints 11:30 at the counter and
 * 05:30 in the office. So the numbers are read straight out of the text and
 * nothing is converted. The clock on the bill is the clock on the wall.
 *
 * Anything that is not that shape — a real timestamp from somewhere else — is
 * still handled, in the machine's own timezone.
 */
export const billMoment = (value) => {
  if (!value) return "";

  const text = String(value);
  const asWritten = text.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (asWritten) {
    const [, year, month, day, hour, minute] = asWritten;
    return `${day} ${MONTHS[Number(month) - 1] ?? month} ${year}  ${hour}:${minute}`;
  }

  const when = new Date(text);
  if (isNaN(when.getTime())) return text;
  return (
    `${two(when.getDate())} ${MONTHS[when.getMonth()]} ${when.getFullYear()}` +
    `  ${two(when.getHours())}:${two(when.getMinutes())}`
  );
};

export default billMoment;
