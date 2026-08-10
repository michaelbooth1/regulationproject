"""Focused regression tests for transcript speaker boundaries."""

import unittest
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent))

from transcribe_episode import split_segment_by_speaker


class FakeDiarization:
    def __init__(self, turns):
        self.turns = turns

    def itertracks(self, yield_label=False):
        for start, end, label in self.turns:
            turn = SimpleNamespace(start=start, end=end)
            yield turn, None, label


def word(start, end, text):
    return SimpleNamespace(start=start, end=end, word=text)


class SplitSegmentBySpeakerTests(unittest.TestCase):
    def test_splits_a_whisper_segment_at_a_speaker_change(self):
        segment = SimpleNamespace(
            start=0.0,
            end=4.0,
            text="Eric speaks. Geoff replies.",
            words=[
                word(0.0, 0.8, " Eric"),
                word(0.8, 1.6, " speaks."),
                word(2.0, 2.8, " Geoff"),
                word(2.8, 3.8, " replies."),
            ],
        )
        diarization = FakeDiarization([
            (0.0, 1.8, "SPEAKER_ERIC"),
            (1.9, 4.0, "SPEAKER_GEOFF"),
        ])

        self.assertEqual(
            split_segment_by_speaker(segment, diarization),
            [
                {
                    "start": 0.0,
                    "end": 1.6,
                    "text": "Eric speaks.",
                    "speaker": "SPEAKER_ERIC",
                },
                {
                    "start": 2.0,
                    "end": 3.8,
                    "text": "Geoff replies.",
                    "speaker": "SPEAKER_GEOFF",
                },
            ],
        )

    def test_falls_back_when_word_timestamps_are_unavailable(self):
        segment = SimpleNamespace(
            start=1.0,
            end=3.0,
            text=" A legacy segment. ",
            words=None,
        )
        diarization = FakeDiarization([(0.0, 4.0, "SPEAKER_ERIC")])

        self.assertEqual(
            split_segment_by_speaker(segment, diarization),
            [{
                "start": 1.0,
                "end": 3.0,
                "text": "A legacy segment.",
                "speaker": "SPEAKER_ERIC",
            }],
        )


if __name__ == "__main__":
    unittest.main()
