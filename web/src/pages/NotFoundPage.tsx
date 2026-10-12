import { ButtonLink } from "../components/ui";

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-32 sm:px-6">
      <h1 className="font-display text-6xl">Nothing here.</h1>
      <p className="mt-4 text-muted">That page doesn't exist, or it belongs to another learner.</p>
      <ButtonLink to="/" className="mt-8">
        Back to problems
      </ButtonLink>
    </div>
  );
}
