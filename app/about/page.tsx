import Link from "next/link";
import { CARD_CLASS, PILL_CLASS, CANDY_BG_CLASSES } from "@/lib/ui";

const PROGRAM_FEATURE = {
  title: "5/3/1 Program",
  body: "A 4-day, 3-week training cycle with automatic weight calculations from your training maxes. Warm-ups, work sets, and assistance work are all worked out for you.",
};

const FEATURES = [
  {
    title: "Live Workout Tracking",
    body: "Check off sets as you go, with elapsed and rest timers, plate-loading math for barbell lifts, and an easy way to add or edit extra sets mid-session.",
  },
  {
    title: "INOL Intensity Score",
    body: "A live-updating draggable widget scores how hard a session was, with a results screen and a tier label once you finish.",
  },
  {
    title: "Personal Records",
    body: "Main-lift PRs are detected automatically from your estimated 1RM and celebrated on the feed the moment you hit one.",
  },
  {
    title: "Social Feed",
    body: "Every completed workout, and every accessory day, posts to a feed your friends can see, comment on, and cheer you on in.",
  },
  {
    title: "Accessory Days",
    body: "Log cross-training and cardio (Run, Bike, Swim, Yoga, and more) any number of times a week, with optional duration and distance.",
  },
];

export default function AboutPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">About</h1>
        <Link href="/" className={`${PILL_CLASS} bg-brutal-cyan`}>
          ← Home
        </Link>
      </div>

      <div className={`${CARD_CLASS} bg-brutal-yellow p-6`}>
        <h2 className="text-2xl font-bold">Pretty Heavy</h2>
        <p className="mt-2 text-sm font-medium">
          A mobile-first strength training app for running a customized 5/3/1 program, with
          automatic weight math, live set tracking, and a feed to share it all with friends.
        </p>
      </div>

      <div className={`${CARD_CLASS} ${CANDY_BG_CLASSES[0]} p-4`}>
        <h3 className="text-lg font-bold">{PROGRAM_FEATURE.title}</h3>
        <p className="mt-1 text-sm font-medium">{PROGRAM_FEATURE.body}</p>
      </div>

      <div className={`${CARD_CLASS} bg-brutal-white p-6`}>
        <h2 className="text-xl font-bold">Finding Your Training Max</h2>
        <div className="mt-2 flex flex-col gap-2 text-sm font-medium">
          <p>
            Every cycle starts with a training max for each main and assistance lift. That number
            drives all the weight math, so it&apos;s worth getting right.
          </p>
          <p>
            Start with your true 1-rep max: the heaviest weight you can lift once with good form.
            If you don&apos;t know it exactly, estimate it from a recent hard set of a few reps
            using the Epley formula, the same one this app uses to detect PRs on the feed:
          </p>
          <p className={`${CARD_CLASS} bg-brutal-cyan px-3 py-2 text-center font-bold`}>
            1RM ≈ weight × (1 + reps ÷ 30)
          </p>
          <p>
            Take 90% of that number, and that&apos;s your training max. Working from 90% instead
            of your true max keeps every prescribed set a little short of your limit, which is
            what makes the program sustainable cycle after cycle.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {FEATURES.map((feature, i) => (
          <div
            key={feature.title}
            className={`${CARD_CLASS} ${CANDY_BG_CLASSES[(i + 1) % CANDY_BG_CLASSES.length]} p-4`}
          >
            <h3 className="text-lg font-bold">{feature.title}</h3>
            <p className="mt-1 text-sm font-medium">{feature.body}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
