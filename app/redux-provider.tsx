"use client";

import { store } from "@/lib/StatesController";
import { PropsWithChildren } from "react";
import { Provider } from "react-redux";

export default function ReduxProvider({ children }: PropsWithChildren) {
    return <Provider store={store}>{children}</Provider>;
}