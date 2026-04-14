const SELECT_CHEVRON_BG =
  "bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23999%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

export const adminNativeFieldBaseClass =
  "border-input text-foreground bg-background shadow-xs transition-[color,background-color,border-color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] dark:bg-input/30 disabled:cursor-not-allowed disabled:opacity-50";

export const adminNativeSelectClass =
  `${adminNativeFieldBaseClass} h-9 w-full min-w-0 cursor-pointer appearance-none rounded-md border px-3 py-1 text-base md:text-sm pr-8 ${SELECT_CHEVRON_BG}`;

export const adminNativeDateTimeInputClass =
  `${adminNativeFieldBaseClass} h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base md:text-sm`;
