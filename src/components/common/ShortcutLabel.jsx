import React from "react";

/**
 * A button's name with its keyboard letter marked.
 *
 * In English the letter is in the word, so it is underlined where it stands:
 * "C<u>u</u>stomer" is pressed with U, and nothing extra is printed on a
 * screen that is already full.
 *
 * In Arabic it is not. The keys are still the Latin ones the keyboard sends —
 * U is U whatever language the screen is in — and underlining a letter that
 * does not appear in "العميل" is impossible. So the key is shown after the
 * word instead, small and dim. The cashier who learned the shortcuts keeps
 * them; nobody is shown a word with a letter underlined at random.
 */
const ShortcutLabel = ({ text, char }) => {
  const label = String(text ?? "");
  const key = String(char ?? "");
  const at = key ? label.toLowerCase().indexOf(key.toLowerCase()) : -1;

  if (at === -1)
    return (
      <span>
        {label}
        {key && (
          <span className="ms-1 align-middle text-[0.7em] font-semibold opacity-60">
            ({key.toUpperCase()})
          </span>
        )}
      </span>
    );

  return (
    <span>
      {label.slice(0, at)}
      <u className="underline decoration-1 underline-offset-2">{label[at]}</u>
      {label.slice(at + 1)}
    </span>
  );
};

export default ShortcutLabel;
