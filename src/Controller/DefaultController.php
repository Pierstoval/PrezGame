<?php

namespace App\Controller;

use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Cache\Adapter\AdapterInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

class DefaultController extends AbstractController
{
    private $cache;

    public function __construct(AdapterInterface $cache)
    {
        $this->cache = $cache;
    }

    /**
     * @Route("/", name="default")
     */
    public function index(): Response
    {
        return $this->redirectToRoute('presentation');
    }

    /**
     * @Route("/button", name="button", methods={"GET", "POST"})
     */
    public function button(Request $request, Session $session): Response
    {
        if ($request->isMethod('POST')) {

            $helped = false;

            $cacheItem = $this->cache->getItem('current_slide');
            $values = $cacheItem->get();

            if ($values) {
                $helpedSlides = $session->get('helped_slides', []);

                if (!isset($helpedSlides[$values['id']])) {
                    $values['amount'] = ($values['amount'] ?? 0) + 5000;
                    $cacheItem->set($values);
                    $this->cache->save($cacheItem);
                    $helped = true;
                    $helpedSlides[$values['id']] = true;
                    $session->set('helped_slides', $helpedSlides);
                }
            }

            return new Response($helped ? '1' : '0');
        }

        return $this->render('default/button.html.twig');
    }

    /**
     * @Route("/presentation/{presentationName}", name="presentation", methods={"GET"})
     */
    public function presentation($presentationName = 'default', Session $session): Response
    {
        $session->set('slide_id', 'first');

        $slidesFile = "slides/$presentationName.html.twig";

        if (!$this->get('twig')->getLoader()->exists($slidesFile)) {
            throw $this->createNotFoundException('Presentation not found.');
        }

        return $this->render('default/index.html.twig', [
            'presentation_slides' => $slidesFile,
        ]);
    }

    /**
     * @Route("/update-session-slide", name="update_session_slide", defaults={"_format": "json"}, methods={"POST"})
     */
    public function updateSessionSlide(Request $request, Session $session): JsonResponse
    {
        if (!$session->get('slide_id')) {
            throw new AccessDeniedHttpException();
        }

        if (!$request->getContent()) {
            throw new BadRequestHttpException();
        }

        $session->set('slide_id', $id = $request->getContent());

        $cacheItem = $this->cache->getItem('current_slide');
        $cacheItem->set([
            'id' => $id,
            'amount' => 0,
        ]);
        $this->cache->save($cacheItem);

        return new JsonResponse($id);
    }

    /**
     * @Route("/check-session-slide", name="check_session_slide", defaults={"_format": "json"}, methods={"GET"})
     */
    public function checkSessionSlide(Session $session): JsonResponse
    {
        if (!$session->get('slide_id')) {
            throw new AccessDeniedHttpException();
        }

        $cacheItem = $this->cache->getItem('current_slide');

        $values = $cacheItem->get();

        return new JsonResponse(($values['amount'] ?? 0));
    }
}
