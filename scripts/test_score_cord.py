import unittest
from decimal import Decimal
from score_cord import money,score_fields
class ScoringTests(unittest.TestCase):
 def test_amount_formats(self):
  for text,value in [('60.000','60000'),('60,000','60000'),('13.20','13.20'),('Rp 60.000,00','60000'),('-60.000','-60000'),('1,234.50','1234.50')]:self.assertEqual(money(text),Decimal(value))
  self.assertIsNone(money('2026-10-17'));self.assertIsNone(money('not found'))
 def test_missing_wrong_and_ambiguous_are_not_credited(self):
  expected={'total':'60.000','tax':'5.455'}
  self.assertEqual([x['correct'] for x in score_fields({'fields':[{'name':'total','value':'60000'}]},expected)],[True,False])
  self.assertFalse(score_fields({'fields':[{'name':'total','value':'60000'},{'name':'grand total','value':'50000'}]},expected)[0]['correct'])
  self.assertFalse(score_fields({},expected)[0]['correct'])
if __name__=='__main__':unittest.main()
