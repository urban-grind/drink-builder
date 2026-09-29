"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChoiceButton } from "@/components/choice-button";
import { DrinkBuilderCup } from "@/components/drink-builder-cup";
import { ExtraGroup } from "@/components/extra-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import { rememberMyDrink } from "@/lib/my-drink";
import { addIns, baseAllowsNone, bases, coldFoams, milks, sauces, selectionLimits, syrups } from "@/lib/menu";
import type { FieldErrors, PublicDrink } from "@/lib/types";
import { validatePublish } from "@/lib/validation";

const fieldIds: Record<string, string> = {
  name: "drink-name",
  description: "drink-description",
  creatorName: "creator-name",
  creatorEmail: "creator-email",
  base: "field-base",
  milk: "field-milk",
  sauces: "field-sauces",
  syrups: "field-syrups",
  coldFoam: "field-cold-foam",
  addIns: "field-add-ins",
};

function toggleLimited(current: string[], id: string, limit: number): string[] {
  if (current.includes(id)) return current.filter((item) => item !== id);
  if (current.length >= limit) return current;
  return [...current, id];
}

/** Clicking the selected sauce clears it. Clicking another sauce replaces it. */
function replaceSauce(current: string[], id: string, syrupCount: number): string[] {
  if (current.length === 1 && current[0] === id) return [];
  if (syrupCount >= 2) return current;
  return [id];
}

function toggleSyrup(current: string[], id: string, sauceSelected: boolean): string[] {
  if (current.includes(id)) return current.filter((item) => item !== id);
  const limit = sauceSelected ? 1 : selectionLimits.syrups;
  if (current.length >= limit) return current;
  return [...current, id];
}

function replaceColdFoam(current: string, id: string): string {
  return current === id ? "" : id;
}

export function DrinkBuilder() {
  const router = useRouter();
  const [base, setBase] = useState("");
  const [milkId, setMilkId] = useState("");
  const [syrupIds, setSyrupIds] = useState<string[]>([]);
  const [sauceIds, setSauceIds] = useState<string[]>([]);
  const [coldFoamId, setColdFoamId] = useState("");
  const [addInIds, setAddInIds] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [creatorEmail, setCreatorEmail] = useState("");
  const [fields, setFields] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const milkLocked = base === "";
  const toppingsLocked = milkLocked || milkId === "";

  function chooseBase(id: string) {
    if (id === base) {
      setBase("");
      setSauceIds([]);
      setSyrupIds([]);
      setColdFoamId("");
      return;
    }
    if (milkId === "none" && !baseAllowsNone(id)) {
      setMilkId("");
      setSauceIds([]);
      setSyrupIds([]);
      setColdFoamId("");
    }
    setBase(id);
  }

  function chooseMilk(id: string) {
    if (milkLocked || (id === "none" && !baseAllowsNone(base))) return;
    if (id === milkId) {
      setMilkId("");
      setSauceIds([]);
      setSyrupIds([]);
      setColdFoamId("");
      return;
    }
    setMilkId(id);
  }

  const recipe = useMemo(
    () => ({
      base,
      milk: milkId,
      syrups: syrupIds,
      sauces: sauceIds,
      coldFoam: coldFoamId,
      addIns: addInIds,
    }),
    [base, milkId, syrupIds, sauceIds, coldFoamId, addInIds],
  );

  function focusFirst(nextFields: FieldErrors) {
    const first = Object.keys(fieldIds).find((key) => nextFields[key]);
    if (!first) return;
    const element = document.getElementById(fieldIds[first]);
    element?.focus();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const payload = {
      name,
      description,
      creatorName,
      creatorEmail,
      base,
      milk: milkId,
      syrups: syrupIds,
      sauces: sauceIds,
      coldFoam: coldFoamId,
      addIns: addInIds,
    };
    const parsed = validatePublish(payload);
    if (!parsed.ok) {
      setFields(parsed.fields);
      setFormError(parsed.message);
      focusFirst(parsed.fields);
      return;
    }

    setPending(true);
    setFormError(null);
    setFields({});
    try {
      const data = await requestJson<{ drink: PublicDrink }>("/api/drinks", {
        method: "POST",
        body: JSON.stringify(parsed.value),
      });
      rememberMyDrink(data.drink.id);
      router.push(`/drinks/${data.drink.id}/congrats`);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        const nextFields = error.fields ?? {};
        if (error.code === "EMAIL_IN_USE") {
          nextFields.creatorEmail = error.message;
        }
        setFields(nextFields);
        setFormError(error.message);
        focusFirst(nextFields);
      } else {
        setFormError("The drink didn't publish. Try again.");
      }
      setPending(false);
    }
  }

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(300px,420px)_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-24">
        <DrinkBuilderCup recipe={recipe} drinkName={name} />
      </div>
      <form className="flex flex-col gap-8" noValidate aria-busy={pending} onSubmit={onSubmit}>
        <fieldset id="field-base" tabIndex={-1} className="scroll-mt-24 rounded-2xl outline-none">
          <legend className="font-heading text-2xl">Base</legend>
          <p className="mt-1 text-sm text-muted-foreground">Nothing is selected. The base is the drink. Pick one.</p>
          {fields.base ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {fields.base}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Base">
            {bases.map((item) => (
              <ChoiceButton
                key={item.id}
                name={item.name}
                image={item.image}
                pressed={base === item.id}
                onClick={() => chooseBase(item.id)}
              />
            ))}
          </div>
        </fieldset>

        <fieldset id="field-milk" tabIndex={-1} className="scroll-mt-24 rounded-2xl outline-none">
          <legend className="font-heading text-2xl">Milk</legend>
          <p className="mt-1 text-sm text-muted-foreground">
            Nothing is selected. Pick one. Choosing another replaces it. None skips milk.
          </p>
          {fields.milk ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {fields.milk}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Milk">
            {milks.map((item) => (
              <ChoiceButton
                key={item.id}
                name={item.name}
                image={item.image}
                pressed={milkId === item.id}
                disabled={milkLocked || (item.id === "none" && !baseAllowsNone(base))}
                onClick={() => chooseMilk(item.id)}
              />
            ))}
          </div>
        </fieldset>

        <fieldset id="field-sauces" tabIndex={-1} className="scroll-mt-24 rounded-2xl outline-none">
          <legend className="font-heading text-2xl">Sauces and syrups</legend>
          <p id="sauce-syrup-rule" className="mt-1 text-sm text-muted-foreground">
            {syrupIds.length >= 2
              ? "Two syrups are selected, so a sauce stays off until you clear one syrup. Either one sauce and one syrup, or two syrups. Not a sauce plus two syrups."
              : sauceIds.length > 0
                ? "A sauce is selected, so a second syrup stays off until you clear the sauce. Choosing another sauce replaces this one. Either one sauce and one syrup, or two syrups."
                : "Either one sauce and one syrup, or two syrups. Not a sauce plus two syrups. Choosing another sauce replaces the one you have. None is fine."}
          </p>
          {fields.sauces ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {fields.sauces}
            </p>
          ) : null}
          {fields.syrups && fields.syrups !== fields.sauces ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {fields.syrups}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Sauces" aria-describedby="sauce-syrup-rule">
            {sauces.map((item) => {
              const pressed = sauceIds.includes(item.id);
              return (
                <ChoiceButton
                  key={item.id}
                  name={item.name}
                  image={item.image}
                  pressed={pressed}
                  disabled={toppingsLocked || (!pressed && syrupIds.length >= 2)}
                  describedBy="sauce-syrup-rule"
                  onClick={() => {
                    if (toppingsLocked) return;
                    setSauceIds((current) => replaceSauce(current, item.id, syrupIds.length));
                  }}
                />
              );
            })}
          </div>
          <div
            id="field-syrups"
            tabIndex={-1}
            className="mt-3 flex flex-wrap gap-2 scroll-mt-24 outline-none"
            role="group"
            aria-label="Syrups"
            aria-describedby="sauce-syrup-rule"
          >
            {syrups.map((item) => {
              const pressed = syrupIds.includes(item.id);
              const secondSyrupBlocked = sauceIds.length > 0 && syrupIds.length >= 1 && !pressed;
              return (
                <ChoiceButton
                  key={item.id}
                  name={item.name}
                  image={item.image}
                  pressed={pressed}
                  disabled={toppingsLocked || secondSyrupBlocked || (!pressed && syrupIds.length >= selectionLimits.syrups)}
                  describedBy="sauce-syrup-rule"
                  onClick={() => {
                    if (toppingsLocked) return;
                    setSyrupIds((current) => toggleSyrup(current, item.id, sauceIds.length > 0));
                  }}
                />
              );
            })}
          </div>
        </fieldset>
        <ExtraGroup
          id="field-cold-foam"
          legend="Cold foam"
          items={coldFoams}
          selected={coldFoamId ? [coldFoamId] : []}
          limit={selectionLimits.coldFoams}
          replace
          locked={toppingsLocked}
          error={fields.coldFoam}
          onToggle={(id) => {
            if (toppingsLocked) return;
            setColdFoamId((current) => replaceColdFoam(current, id));
          }}
        />
        <ExtraGroup
          id="field-add-ins"
          legend="Add-ins"
          items={addIns}
          selected={addInIds}
          limit={selectionLimits.addIns}
          error={fields.addIns}
          onToggle={(id) => setAddInIds((current) => toggleLimited(current, id, selectionLimits.addIns))}
        />

        <div className="grid gap-5 rounded-2xl bg-white p-5 shadow-[0_16px_40px_rgb(39_75_58/0.06)] sm:p-6">
          <div className="grid gap-2">
            <Label htmlFor="drink-name">Drink name</Label>
            <Input
              id="drink-name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              autoComplete="off"
              aria-invalid={Boolean(fields.name)}
              aria-describedby={fields.name ? "drink-name-error" : undefined}
              placeholder="Window light"
              className="h-11"
            />
            {fields.name ? (
              <p id="drink-name-error" role="alert" className="text-sm text-destructive">
                {fields.name}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="drink-description">Description</Label>
            <Textarea
              id="drink-description"
              name="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={400}
              rows={3}
              aria-invalid={Boolean(fields.description)}
              aria-describedby={fields.description ? "drink-description-error" : "drink-description-help"}
              placeholder="Optional. How it should taste."
              className="min-h-28"
            />
            <p id="drink-description-help" className="text-sm text-muted-foreground">
              Optional.
            </p>
            {fields.description ? (
              <p id="drink-description-error" role="alert" className="text-sm text-destructive">
                {fields.description}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="creator-name">Your name</Label>
            <Input
              id="creator-name"
              name="creatorName"
              value={creatorName}
              onChange={(event) => setCreatorName(event.target.value)}
              maxLength={60}
              autoComplete="name"
              aria-invalid={Boolean(fields.creatorName)}
              aria-describedby={fields.creatorName ? "creator-name-error" : undefined}
              placeholder="The name on the cup"
              className="h-11"
            />
            {fields.creatorName ? (
              <p id="creator-name-error" role="alert" className="text-sm text-destructive">
                {fields.creatorName}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="creator-email">Email</Label>
            <Input
              id="creator-email"
              name="creatorEmail"
              type="email"
              inputMode="email"
              value={creatorEmail}
              onChange={(event) => setCreatorEmail(event.target.value)}
              maxLength={254}
              autoComplete="email"
              aria-invalid={Boolean(fields.creatorEmail)}
              aria-describedby={
                fields.creatorEmail ? "creator-email-error creator-email-help" : "creator-email-help"
              }
              placeholder="you@example.com"
              className="h-11"
            />
            <p id="creator-email-help" className="text-sm text-muted-foreground">
              Stored with the drink. Not shown on the board. One drink per email.
            </p>
            {fields.creatorEmail ? (
              <p id="creator-email-error" role="alert" className="text-sm text-destructive">
                {fields.creatorEmail}
              </p>
            ) : null}
          </div>

          {formError ? (
            <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          ) : null}

          <Button type="submit" disabled={pending} className="h-12 rounded-full px-6 text-base">
            {pending ? "Publishing…" : "Publish to the board"}
          </Button>
        </div>
      </form>
    </div>
  );
}
