"use client";
import { useClientQueries } from "@zenstackhq/tanstack-query/react";
import { schema } from "@zenstack/schema-lite";

/** Hooks tipados do ZenStack (useFindMany, useCreate...). */
export function useDb() {
  return useClientQueries(schema);
}
