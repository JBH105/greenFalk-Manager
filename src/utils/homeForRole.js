/**
 * Where someone lands once they are signed in.
 *
 * A till is opened, used all service and closed again, so it must come back up
 * where the work is rather than at a login form it has already answered. The
 * sign-in screen and the "already signed in" check both ask this, so the two
 * cannot send the same person to different places.
 */
export const homeForRole = (role) => {
  switch (role) {
    // An owner works across outlets and has to say which one first.
    case "owner":
      return "/select-outlet";

    // The floor: both of these start at the tables.
    case "cashier":
    case "captain":
      return "/pos/tables";

    // The kitchen has one screen and nothing else.
    case "chef":
      return "/pos/invoices";

    default:
      return "/";
  }
};
