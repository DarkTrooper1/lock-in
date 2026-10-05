// Default home plan: 2 x 5kg dumbbells + 1 kettlebell, done in a bedroom.
// Each muscle group gets at least 48h between hard sessions, Sunday is a full rest day.
// Keyed by day of week (0 = Sunday). Edit it in Settings.

export const WARM_UP = '5 min warm-up first: arm circles, 10 bodyweight squats, 10 hip hinges, 10 slow push-ups against the bed.';

export const PROGRESSION = 'When every set feels easy, add 2 reps per set, or take 3 seconds to lower each rep. With light weights, slower is harder.';

export const DEFAULT_PLAN = {
  1: {
    name: 'Upper body · push',
    exercises: [
      { id: 'pushup', name: 'Push-ups', sets: 3, reps: '10–15', tip: 'Knees down once your form breaks. Body in a straight line, chest to just above the floor.' },
      { id: 'floorpress', name: 'Dumbbell floor press', sets: 3, reps: '15', tip: 'Lie on your back, elbows at 45°, pause when your elbows touch the floor.' },
      { id: 'shoulderpress', name: 'Dumbbell shoulder press', sets: 3, reps: '12', tip: 'Standing, ribs down, squeeze glutes so your lower back doesn’t arch.' },
      { id: 'ohte', name: 'Overhead tricep extension (kettlebell)', sets: 3, reps: '12', tip: 'Hold the kettlebell by the handle sides, elbows pointing at the ceiling, lower behind your head.' },
      { id: 'latraise', name: 'Lateral raises', sets: 2, reps: '15', tip: 'Slow, slight bend in the elbow, stop at shoulder height.' },
    ],
  },
  2: {
    name: 'Legs',
    exercises: [
      { id: 'goblet', name: 'Kettlebell goblet squat', sets: 3, reps: '12', tip: 'Hold it at your chest, heels down, sit between your knees.' },
      { id: 'revlunge', name: 'Reverse lunges (dumbbells)', sets: 3, reps: '10 / leg', tip: 'Step back, back knee just above the floor, push through the front heel.' },
      { id: 'rdl', name: 'Kettlebell Romanian deadlift', sets: 3, reps: '12', tip: 'Push your hips back, flat back, feel the stretch in your hamstrings.' },
      { id: 'bridge', name: 'Single-leg glute bridge', sets: 3, reps: '12 / leg', tip: 'Squeeze at the top for a second.' },
      { id: 'calf', name: 'Calf raises (holding dumbbells)', sets: 3, reps: '20', tip: 'Pause at the top, lower slowly. Use a step if you have one.' },
    ],
  },
  3: {
    name: 'Core + mobility (easy day)',
    exercises: [
      { id: 'plank', name: 'Plank', sets: 3, reps: '40 sec', tip: 'Squeeze glutes, don’t let your hips sag.' },
      { id: 'deadbug', name: 'Dead bugs', sets: 3, reps: '10 / side', tip: 'Lower back pressed into the floor the whole time.' },
      { id: 'birddog', name: 'Bird dogs', sets: 3, reps: '10 / side', tip: 'Slow, hips level, pause when fully stretched out.' },
      { id: 'halo', name: 'Kettlebell halos', sets: 2, reps: '8 each way', tip: 'Light and slow around your head. Good for desk-trader shoulders.' },
      { id: 'stretch', name: 'Stretch: hips, hamstrings, chest, upper back', sets: 1, reps: '10 min' },
    ],
  },
  4: {
    name: 'Upper body · pull',
    exercises: [
      { id: 'kbrow', name: 'One-arm kettlebell row', sets: 3, reps: '10 / side', tip: 'Hand and knee on the bed, flat back, pull the bell to your hip.' },
      { id: 'dbrow', name: 'Bent-over dumbbell row', sets: 3, reps: '15', tip: 'Hinge forward, squeeze your shoulder blades together at the top.' },
      { id: 'revfly', name: 'Reverse flys', sets: 3, reps: '15', tip: 'Bent over, arms slightly bent, raise out to the sides.' },
      { id: 'curls', name: 'Bicep curls', sets: 3, reps: '12', tip: 'Take 3 seconds to lower. No swinging.' },
      { id: 'hammer', name: 'Hammer curls', sets: 3, reps: '12', tip: 'Thumbs up, elbows pinned to your sides.' },
    ],
  },
  5: {
    name: 'Full body kettlebell',
    exercises: [
      { id: 'swing', name: 'Kettlebell swings', sets: 4, reps: '15', tip: 'Snap your hips forward. The arms just hold on. Flat back, bell to chest height.' },
      { id: 'goblet', name: 'Goblet squat', sets: 3, reps: '10' },
      { id: 'pushup', name: 'Push-ups', sets: 3, reps: '10' },
      { id: 'suitcase', name: 'Suitcase march (kettlebell in one hand)', sets: 3, reps: '30 sec / side', tip: 'March on the spot, stay tall, don’t lean toward the weight.' },
      { id: 'shouldertap', name: 'Plank shoulder taps', sets: 3, reps: '20', tip: 'Feet wide, keep your hips still.' },
    ],
  },
  6: {
    name: 'Arms + core',
    exercises: [
      { id: 'curls', name: 'Bicep curls', sets: 3, reps: '15', tip: 'Slow lowering again.' },
      { id: 'hammer', name: 'Hammer curls', sets: 3, reps: '15' },
      { id: 'ohte', name: 'Overhead tricep extension (kettlebell)', sets: 3, reps: '15' },
      { id: 'sideplank', name: 'Side plank', sets: 2, reps: '30 sec / side' },
      { id: 'twist', name: 'Russian twists (kettlebell)', sets: 3, reps: '20', tip: 'Feet down if your lower back complains.' },
    ],
  },
  0: { name: 'Rest day', rest: true, exercises: [], note: 'Recovery is when muscle is actually built. A walk or some light stretching is fine.' },
};
