"use client";

import { createContext, useContext } from "react";

/** The few workspace facts deep components need, like the currency new customers start in. */
export const WorkspaceContext = createContext<{ currency: string }>({ currency: "USD" });
export const useWorkspaceCurrency = () => useContext(WorkspaceContext).currency;
