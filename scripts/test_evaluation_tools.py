import json,subprocess,tempfile,unittest
from pathlib import Path
from prepare_wikispeedia import visits
ROOT=Path(__file__).resolve().parents[1]
class EvaluationTests(unittest.TestCase):
 def test_back_clicks_are_real_destinations_not_literal_tokens(self):
  self.assertEqual(visits('A;B;C;<;D'),['A','B','C','B','D'])
  self.assertIsNone(visits('A;<'))
 def test_report_only_preserves_saved_custom_scenarios_without_backend_calls(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d);trials=[]
   for mode,wait in [('OFF',100),('ON',10)]:
    trials.append({'scenario':'actual-receipt','mode':mode,'repetition':1,'clean':True,'completed':True,'actions':[{'waitMs':wait}],'metrics':{'demandCalls':1,'speculativeCalls':0,'failures':0,'failedActions':0,'totalWaitMs':wait,'usedPrefetches':0,'unusedPrefetches':0}})
   (p/'results.json').write_text(json.dumps({'metadata':{'repetitions':1,'dwellMs':500,'inputDescription':'Real test fixture, not synthetic default.','scenarios':[{'name':'actual-receipt'}]},'trials':trials}))
   subprocess.run(['node',str(ROOT/'scripts/benchmark_ai.mjs'),'--report-only','--base','http://127.0.0.1:1','--out',d],check=True,capture_output=True,timeout=10)
   report=(p/'summary.md').read_text()
   self.assertIn('| actual-receipt | 100.0 ms | 10.0 ms |',report)
   self.assertIn('Real test fixture',report)
   self.assertNotIn('receipt-extraction',report)
if __name__=='__main__':unittest.main()
