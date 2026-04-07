-- Frogo2026 Seed Data
-- Curated channels with great educational content

-- ============================================
-- CHANNELS
-- ============================================

INSERT INTO channels (name, slug, description, icon) VALUES
  ('AI Programming', 'ai-programming', 'Learn to code with AI — prompt engineering, agents, copilots, and the future of software development.', '🤖'),
  ('Philosophy', 'philosophy', 'Game theory, social dilemmas, and the paradoxes of human cooperation — Tragedy of the Commons, Prisoner''s Dilemma, and more.', '🏛️'),
  ('Buddhism', 'buddhism', 'The Four Noble Truths, the Four Immeasurables (loving-kindness, compassion, sympathetic joy, equanimity), and paths to understanding.', '🪷'),
  ('Kids Animals', 'kids-animals', 'Fun, educational animal videos for kids — cute creatures, wildlife documentaries, and amazing animal facts.', '🐾'),
  ('Business', 'business', 'Startup strategy, leadership, product thinking, and lessons from the best founders and operators.', '💼')
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- AI PROGRAMMING VIDEOS
-- ============================================

INSERT INTO videos (channel_id, youtube_id, title, description, thumbnail_url, duration_seconds, position) VALUES

-- AI Programming
((SELECT id FROM channels WHERE slug = 'ai-programming'), 'jkrNMKz9pWU', 'Let''s build GPT: from scratch, in code, spelled out', 'Andrej Karpathy builds a GPT language model from scratch, explaining every concept along the way.', 'https://img.youtube.com/vi/jkrNMKz9pWU/maxresdefault.jpg', 7380, 1),
((SELECT id FROM channels WHERE slug = 'ai-programming'), 'zjkBMFhNj_g', 'Intro to Large Language Models', 'Andrej Karpathy''s accessible introduction to LLMs — what they are, how they work, and where they''re going.', 'https://img.youtube.com/vi/zjkBMFhNj_g/maxresdefault.jpg', 3600, 2),
((SELECT id FROM channels WHERE slug = 'ai-programming'), 'kCc8FmEb1nY', 'Let''s build the GPT Tokenizer', 'Deep dive into tokenization — the crucial first step in how LLMs process text.', 'https://img.youtube.com/vi/kCc8FmEb1nY/maxresdefault.jpg', 7920, 3),
((SELECT id FROM channels WHERE slug = 'ai-programming'), 'EXPsBh7TXnI', 'How I Use AI Coding Agents (as a Staff Engineer)', 'Practical guide to using AI coding assistants effectively in real engineering workflows.', 'https://img.youtube.com/vi/EXPsBh7TXnI/maxresdefault.jpg', 1200, 4),
((SELECT id FROM channels WHERE slug = 'ai-programming'), 'UF8uR6Z6KLc', 'Stanford CS229 — Machine Learning (Andrew Ng)', 'The classic Stanford ML course that launched a generation of AI engineers.', 'https://img.youtube.com/vi/UF8uR6Z6KLc/maxresdefault.jpg', 4500, 5),
((SELECT id FROM channels WHERE slug = 'ai-programming'), 'VMj-3S1tku0', 'Attention is All You Need — Paper Explained', 'Yannic Kilcher walks through the landmark Transformer paper that changed everything.', 'https://img.youtube.com/vi/VMj-3S1tku0/maxresdefault.jpg', 2700, 6),

-- ============================================
-- PHILOSOPHY VIDEOS
-- ============================================

-- Tragedy of the Commons & Game Theory
((SELECT id FROM channels WHERE slug = 'philosophy'), 'CxC161GvMPc', 'The Tragedy of the Commons', 'TED-Ed explains Garrett Hardin''s classic concept — why shared resources get depleted when individuals act in self-interest.', 'https://img.youtube.com/vi/CxC161GvMPc/maxresdefault.jpg', 300, 1),
((SELECT id FROM channels WHERE slug = 'philosophy'), 'mScpHTIi-kM', 'What game theory teaches us about war', 'TED talk on how game theory explains conflict, cooperation, and the logic of escalation.', 'https://img.youtube.com/vi/mScpHTIi-kM/maxresdefault.jpg', 1080, 2),
((SELECT id FROM channels WHERE slug = 'philosophy'), 't9Lo2fgxWHw', 'The Prisoner''s Dilemma', 'Classic explanation of the most famous problem in game theory — why rational actors betray each other.', 'https://img.youtube.com/vi/t9Lo2fgxWHw/maxresdefault.jpg', 600, 3),
((SELECT id FROM channels WHERE slug = 'philosophy'), 'BOvAbjfJ0x0', 'The Evolution of Trust — An Interactive Guide', 'Nicky Case''s brilliant walkthrough of how trust and cooperation evolve through iterated game theory.', 'https://img.youtube.com/vi/BOvAbjfJ0x0/maxresdefault.jpg', 1800, 4),
((SELECT id FROM channels WHERE slug = 'philosophy'), 'p3Uos2fzIJ0', 'Free Rider Problem Explained', 'Why people benefit from public goods without contributing — and what we can do about it.', 'https://img.youtube.com/vi/p3Uos2fzIJ0/maxresdefault.jpg', 480, 5),
((SELECT id FROM channels WHERE slug = 'philosophy'), 'jILgxeNBK_8', 'Moral Foundations Theory — Jonathan Haidt', 'Haidt explains the psychological foundations of morality and why people disagree about right and wrong.', 'https://img.youtube.com/vi/jILgxeNBK_8/maxresdefault.jpg', 1200, 6),

-- ============================================
-- BUDDHISM VIDEOS
-- ============================================

((SELECT id FROM channels WHERE slug = 'buddhism'), 'tilBs32zN7I', 'The Four Noble Truths — Thich Nhat Hanh', 'The beloved Zen master explains the core teaching of Buddhism: suffering, its origin, cessation, and the path.', 'https://img.youtube.com/vi/tilBs32zN7I/maxresdefault.jpg', 3600, 1),
((SELECT id FROM channels WHERE slug = 'buddhism'), 'PBwJbKTnUjk', 'Loving-Kindness Meditation (Metta)', 'Guided metta meditation — cultivating loving-kindness toward yourself and all beings.', 'https://img.youtube.com/vi/PBwJbKTnUjk/maxresdefault.jpg', 1200, 2),
((SELECT id FROM channels WHERE slug = 'buddhism'), 'qzR62JJCMBQ', 'The Four Immeasurables — Jack Kornfield', 'Jack Kornfield teaches the Brahma Viharas: loving-kindness, compassion, sympathetic joy, and equanimity.', 'https://img.youtube.com/vi/qzR62JJCMBQ/maxresdefault.jpg', 2400, 3),
((SELECT id FROM channels WHERE slug = 'buddhism'), 'Anf1yhX9VQo', 'What is the Eightfold Path?', 'Clear explanation of the Buddha''s practical guide to ending suffering through right understanding, intention, speech, action, livelihood, effort, mindfulness, and concentration.', 'https://img.youtube.com/vi/Anf1yhX9VQo/maxresdefault.jpg', 600, 4),
((SELECT id FROM channels WHERE slug = 'buddhism'), '4N6y6LEwsKc', 'Thich Nhat Hanh — The Art of Mindful Living', 'Full talk on bringing mindfulness into daily life — walking, eating, breathing.', 'https://img.youtube.com/vi/4N6y6LEwsKc/maxresdefault.jpg', 5400, 5),
((SELECT id FROM channels WHERE slug = 'buddhism'), 'aAVPDYhW_nw', 'Alan Watts — The Story of the Chinese Farmer', 'The classic parable about equanimity — maybe good, maybe bad, who knows?', 'https://img.youtube.com/vi/aAVPDYhW_nw/maxresdefault.jpg', 180, 6),

-- ============================================
-- KIDS ANIMALS VIDEOS
-- ============================================

((SELECT id FROM channels WHERE slug = 'kids-animals'), 'aPVLyB0Yc6I', 'Baby Animals Being Adorable', 'Compilation of the cutest baby animal moments — puppies, kittens, pandas, and more.', 'https://img.youtube.com/vi/aPVLyB0Yc6I/maxresdefault.jpg', 600, 1),
((SELECT id FROM channels WHERE slug = 'kids-animals'), 'gGEv54rLvgs', 'Octopus 101 — National Geographic Kids', 'Everything kids need to know about octopuses — eight arms, three hearts, and incredible intelligence.', 'https://img.youtube.com/vi/gGEv54rLvgs/maxresdefault.jpg', 240, 2),
((SELECT id FROM channels WHERE slug = 'kids-animals'), '4PkGLsJiJHE', 'How Do Animals See in the Dark?', 'SciShow Kids explores night vision in owls, cats, and deep-sea creatures.', 'https://img.youtube.com/vi/4PkGLsJiJHE/maxresdefault.jpg', 300, 3),
((SELECT id FROM channels WHERE slug = 'kids-animals'), 'Xs-HbHCcK58', 'Animal Babies Growing Up — Time Lapse', 'Watch baby animals grow up in amazing time-lapse footage.', 'https://img.youtube.com/vi/Xs-HbHCcK58/maxresdefault.jpg', 480, 4),
((SELECT id FROM channels WHERE slug = 'kids-animals'), 'dqT-UlYlg1s', 'Dolphins — Smart, Playful Ocean Friends', 'Learn about dolphin intelligence, communication, and their amazing underwater world.', 'https://img.youtube.com/vi/dqT-UlYlg1s/maxresdefault.jpg', 360, 5),
((SELECT id FROM channels WHERE slug = 'kids-animals'), '2uCOtlaPmNE', 'Penguins of Antarctica — Wild Kratts', 'Join the Kratt Brothers on an adventure with Emperor Penguins in the frozen south.', 'https://img.youtube.com/vi/2uCOtlaPmNE/maxresdefault.jpg', 1500, 6),

-- ============================================
-- BUSINESS VIDEOS
-- ============================================

((SELECT id FROM channels WHERE slug = 'business'), 'UY75MQte4RU', 'How to Build a Startup — Steve Blank', 'The father of the Lean Startup movement explains customer development and why startups aren''t small companies.', 'https://img.youtube.com/vi/UY75MQte4RU/maxresdefault.jpg', 3000, 1),
((SELECT id FROM channels WHERE slug = 'business'), 'bNpx7gpSqbY', 'Peter Thiel — Competition is for Losers', 'Thiel''s Stanford lecture on why monopoly (not competition) drives innovation and value creation.', 'https://img.youtube.com/vi/bNpx7gpSqbY/maxresdefault.jpg', 3000, 2),
((SELECT id FROM channels WHERE slug = 'business'), 'CD-E-LDc384', 'Y Combinator — How to Start a Startup (Lecture 1)', 'Sam Altman and Dustin Moskovitz kick off Stanford''s legendary startup course.', 'https://img.youtube.com/vi/CD-E-LDc384/maxresdefault.jpg', 3000, 3),
((SELECT id FROM channels WHERE slug = 'business'), 'ii1jcLg-eIQ', 'Simon Sinek — Start With Why', 'The golden circle: why purpose-driven companies outperform the competition.', 'https://img.youtube.com/vi/ii1jcLg-eIQ/maxresdefault.jpg', 1080, 4),
((SELECT id FROM channels WHERE slug = 'business'), 'iMZA80XpP6Y', 'Paul Graham — Do Things That Don''t Scale', 'The legendary essay brought to life — why startups must do unscalable things to find product-market fit.', 'https://img.youtube.com/vi/iMZA80XpP6Y/maxresdefault.jpg', 900, 5),
((SELECT id FROM channels WHERE slug = 'business'), 'RfWgVWGEoGE', 'Jeff Bezos — Regret Minimization Framework', 'Bezos explains the decision framework he used to leave his hedge fund job and start Amazon.', 'https://img.youtube.com/vi/RfWgVWGEoGE/maxresdefault.jpg', 180, 6)

ON CONFLICT (channel_id, youtube_id) DO NOTHING;
