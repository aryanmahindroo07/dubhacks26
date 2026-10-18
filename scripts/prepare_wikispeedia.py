"""Prepare local-only public human navigation data, without redistributing raw paths.
Source: Stanford SNAP; cite West & Leskovec (WWW 2012), West et al. (IJCAI 2009).
"""
import hashlib,json,tarfile,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
URL='https://snap.stanford.edu/data/wikispeedia/wikispeedia_paths-and-graph.tar.gz'
SHA='97697096f5d2dcb77aa69e3992305c6c561de89edb9fb10b5ad9feaf8ba534d5'
def visits(path):
    stack=[];seen=[]
    for token in path.split(';'):
        if token=='<':
            if len(stack)<2:return None
            stack.pop();seen.append(stack[-1])
        elif token:stack.append(token);seen.append(token)
    return seen

def main():
    dest=ROOT/'work/wikispeedia';dest.mkdir(parents=True,exist_ok=True);archive=dest/'paths-and-graph.tar.gz'
    if not archive.exists():
        with urllib.request.urlopen(URL,timeout=60) as r:archive.write_bytes(r.read())
    if hashlib.sha256(archive.read_bytes()).hexdigest()!=SHA:raise RuntimeError('Source hash changed; review first.')
    train=[];test=[];groups={'train':set(),'test':set()};invalid=0;counts={}
    with tarfile.open(archive) as tf:
        def lines(name):
            f=tf.extractfile('wikispeedia_paths-and-graph/'+name)
            return [line for line in f.read().decode().splitlines() if line and not line.startswith('#')]
        articles=lines('articles.tsv');links={}
        for line in lines('links.tsv'):
            source,target=line.split('\t');links.setdefault(source,[]).append(target)
        for name in ['paths_finished.tsv','paths_unfinished.tsv']:
            rows=lines(name);counts[name]=len(rows)
            for line in rows:
                cols=line.split('\t');group=cols[0];path=visits(cols[3])
                if not path:invalid+=1;continue
                # Keep the historical seed: changing it would change the published train/test split.
                is_test=int.from_bytes(hashlib.sha256(('requestflow-eval-42:'+group).encode()).digest()[:4],'big')%5==0
                bucket='test' if is_test else 'train';groups[bucket].add(group)
                (test if is_test else train).append(path+['__STOP__'])
    assert not groups['train']&groups['test']
    meta={'source':'https://snap.stanford.edu/data/wikispeedia.html','archiveSha256':SHA,'sourceCounts':counts,'invalidPathsExcluded':invalid,'trainGroups':len(groups['train']),'testGroups':len(groups['test']),'split':'Fixed SHA256 grouping of hashed IP identifier, seed requestflow-eval-42; approx 80/20. Same identifier never occurs on both sides; identifiers are proxies, not guaranteed unique people. Includes finished and unfinished games. No test-time learning.','processing':'Back clicks resolved to their destination via stack; STOP appended at each finished/unfinished path end. Cache starts empty per game and visited pages are excluded from prefetch candidates. Target article is not an input feature. Raw data remains local; report contains aggregates only.'}
    (dest/'prepared.json').write_text(json.dumps({'metadata':meta,'articles':articles,'links':links,'train':train,'test':test}))
    print(json.dumps({**meta,'trainPaths':len(train),'testPaths':len(test)},indent=2))
if __name__=='__main__':main()
